import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import busboy from 'busboy';
import type { Response } from 'express';
import { documents, withTenant } from '@docsage/db';
import { eq, and, isNull } from 'drizzle-orm';
import { PgBoss } from 'pg-boss';
import type { AuthenticatedRequest } from '../auth/middleware.js';
import { logAuditEvent } from '../audit/service.js';
import { queryCache } from '../reliability/cache.js';

const uploadDir = path.resolve(process.cwd(), process.env['UPLOAD_DIR'] ?? './uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Queue client for enqueuing async ingestion
const bossUrl =
  process.env['DATABASE_URL_DIRECT'] ??
  process.env['DATABASE_URL'] ??
  'postgresql://postgres:postgres@localhost:5432/docsage';

let bossInstance: PgBoss | null = null;
export async function getBoss(): Promise<PgBoss> {
  if (!bossInstance) {
    bossInstance = new PgBoss(bossUrl);
    await bossInstance.start();
  }
  return bossInstance;
}

export function handlePdfUpload(req: AuthenticatedRequest, res: Response): void {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.includes('multipart/form-data')) {
    res.status(400).json({ error: 'Invalid content type: expected multipart/form-data' });
    return;
  }

  const maxUploadSizeMb = Number(process.env['MAX_UPLOAD_SIZE_MB'] ?? 50);
  const maxBytes = maxUploadSizeMb * 1024 * 1024;

  const bb = busboy({ headers: req.headers, limits: { files: 1, fileSize: maxBytes } });

  let fileProcessed = false;
  let fileError: string | null = null;
  let statusCode = 400;

  bb.on('file', (_name, fileStream, info) => {
    fileProcessed = true;
    const rawFilename = info.filename || 'uploaded.pdf';
    const sanitizedFilename = path.basename(rawFilename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const tempId = crypto.randomUUID();
    const tempFilePath = path.join(uploadDir, `${tempId}_${sanitizedFilename}`);

    const writeStream = fs.createWriteStream(tempFilePath);
    const hash = crypto.createHash('sha256');
    let bytesRead = 0;
    let firstChunkChecked = false;
    let magicBytesValid = true;

    fileStream.on('data', (chunk: Buffer) => {
      bytesRead += chunk.length;

      if (!firstChunkChecked) {
        firstChunkChecked = true;
        const magic = chunk.subarray(0, 5).toString('utf-8');
        if (!magic.startsWith('%PDF-')) {
          magicBytesValid = false;
          fileStream.destroy();
          writeStream.destroy();
          fs.unlink(tempFilePath, () => {});
          if (!res.headersSent) {
            res
              .status(400)
              .json({ error: 'Invalid file format: file magic bytes do not match %PDF-' });
          }
          return;
        }
      }

      if (bytesRead > maxBytes) {
        fileError = `File exceeds maximum allowed size of ${maxUploadSizeMb}MB`;
        statusCode = 413;
        fileStream.destroy();
        writeStream.destroy();
        fs.unlink(tempFilePath, () => {});
        if (!res.headersSent) {
          res
            .status(413)
            .json({ error: `File exceeds maximum allowed size of ${maxUploadSizeMb}MB` });
        }
        return;
      }

      hash.update(chunk);
      writeStream.write(chunk);
    });

    fileStream.on('end', () => {
      writeStream.end();
    });

    writeStream.on('finish', () => {
      if (!magicBytesValid || fileError) return;

      const contentSha256 = hash.digest('hex');

      void (async () => {
        try {
          const existing = await withTenant(user.tenantId, async (tx) => {
            return tx.query.documents.findFirst({
              where: and(
                eq(documents.tenantId, user.tenantId),
                eq(documents.contentSha256, contentSha256),
                isNull(documents.deletedAt),
              ),
            });
          });

          if (existing) {
            fs.unlink(tempFilePath, () => {});
            res.status(200).json({
              message: 'Duplicate document detected; returning existing record',
              documentId: existing.id,
              isDuplicate: true,
              status: existing.status,
              version: existing.version,
            });
            return;
          }

          const newDoc = await withTenant(user.tenantId, async (tx) => {
            const [inserted] = await tx
              .insert(documents)
              .values({
                tenantId: user.tenantId,
                ownerId: user.sub,
                title: sanitizedFilename.replace(/\.pdf$/i, ''),
                filename: sanitizedFilename,
                mime: 'application/pdf',
                sizeBytes: bytesRead,
                contentSha256,
                status: 'pending',
                version: 1,
              })
              .returning({ id: documents.id });

            if (!inserted) throw new Error('Failed to insert document');

            await logAuditEvent(tx, {
              tenantId: user.tenantId,
              actorId: user.sub,
              action: 'upload',
              entity: 'document',
              entityId: inserted.id,
              meta: { filename: sanitizedFilename, sizeBytes: bytesRead },
            });

            return inserted;
          });

          queryCache.invalidateTenantCorpus(user.tenantId);

          const boss = await getBoss();
          const jobId = await boss.send('document-ingestion', {
            documentId: newDoc.id,
            tenantId: user.tenantId,
            filePath: tempFilePath,
            version: 1,
          });

          res.status(202).json({
            message: 'Document accepted for asynchronous ingestion',
            documentId: newDoc.id,
            jobId,
            status: 'pending',
            isDuplicate: false,
          });
        } catch (err: unknown) {
          fs.unlink(tempFilePath, () => {});
          const msg = err instanceof Error ? err.message : 'Upload processing failure';
          res.status(500).json({ error: msg });
        }
      })();
    });
  });

  bb.on('error', (err: unknown) => {
    const msg = err instanceof Error ? err.message : 'Upload parsing error';
    res.status(statusCode).json({ error: fileError ?? msg });
  });

  bb.on('finish', () => {
    if (!fileProcessed) {
      res.status(400).json({ error: 'No file found in request payload' });
    }
  });

  req.pipe(bb);
}
