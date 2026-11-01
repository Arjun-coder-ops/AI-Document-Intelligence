import { Router, type Response } from 'express';
import busboy from 'busboy';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { documents, chunks, withTenant } from '@docsage/db';
import { eq, and, isNull } from 'drizzle-orm';
import { authenticate, requireRole, type AuthenticatedRequest } from '../auth/middleware.js';
import { logAuditEvent } from '../audit/service.js';
import { PgBoss } from 'pg-boss';
import { createRateLimiterMiddleware } from '../reliability/rate-limiter.js';
import { queryCache } from '../reliability/cache.js';

export const documentsRouter: Router = Router();

const uploadRateLimiter = createRateLimiterMiddleware({
  userCapacity: 5,
  tenantCapacity: 20,
  refillPerMinute: 10,
});

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
async function getBoss(): Promise<PgBoss> {
  if (!bossInstance) {
    bossInstance = new PgBoss(bossUrl);
    await bossInstance.start();
  }
  return bossInstance;
}

// ─── POST /documents (Streaming PDF Upload) ──────────────────────────────────
documentsRouter.post(
  '/',
  authenticate,
  requireRole('editor'),
  uploadRateLimiter,
  (req: AuthenticatedRequest, res: Response): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
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
      // Sanitize filename: strip path traversal and special chars
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

        // Verify PDF magic bytes (%PDF-) on first chunk
        if (!firstChunkChecked) {
          firstChunkChecked = true;
          const magic = chunk.subarray(0, 5).toString('utf-8');
          if (!magic.startsWith('%PDF-')) {
            magicBytesValid = false;
            fileError = 'Invalid file format: file magic bytes do not match %PDF-';
            statusCode = 400;
            fileStream.destroy();
            writeStream.destroy();
            fs.unlink(tempFilePath, () => {});
            return;
          }
        }

        // Enforce max upload size limit
        if (bytesRead > maxBytes) {
          fileError = `File exceeds maximum allowed size of ${maxUploadSizeMb}MB`;
          statusCode = 413;
          fileStream.destroy();
          writeStream.destroy();
          fs.unlink(tempFilePath, () => {});
          return;
        }

        hash.update(chunk);
        writeStream.write(chunk);
      });

      fileStream.on('end', () => {
        writeStream.end();
      });

      writeStream.on('finish', () => {
        if (!magicBytesValid || fileError) {
          return; // Already handled
        }

        const contentSha256 = hash.digest('hex');

        // Execute deduplication check and novel insertion inside tenant context
        void (async () => {
          try {
            // Deduplication check: exists for this tenant and not deleted
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
              // Delete duplicate uploaded file
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

            // Create new document in pending state
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

            // Invalidate query cache for this tenant
            queryCache.invalidateTenantCorpus(user.tenantId);

            // Enqueue asynchronous ingestion job via pg-boss
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
  },
);

// ─── GET /documents (List Tenant Documents) ──────────────────────────────────
documentsRouter.get(
  '/',
  authenticate,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const docs = await withTenant(user.tenantId, async (tx) => {
      return tx.query.documents.findMany({
        where: and(eq(documents.tenantId, user.tenantId), isNull(documents.deletedAt)),
        orderBy: (table, { desc }) => [desc(table.createdAt)],
      });
    });

    res.status(200).json({ documents: docs, total: docs.length });
  },
);

// ─── GET /documents/:id/status ───────────────────────────────────────────────
documentsRouter.get(
  '/:id/status',
  authenticate,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user;
    const rawId = req.params['id'];
    const docId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!user || !docId) {
      res.status(400).json({ error: 'Invalid document request' });
      return;
    }

    const doc = await withTenant(user.tenantId, async (tx) => {
      return tx.query.documents.findFirst({
        where: and(eq(documents.id, docId), eq(documents.tenantId, user.tenantId)),
      });
    });

    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Count chunks
    const chunkCount = await withTenant(user.tenantId, async (tx) => {
      const records = await tx.query.chunks.findMany({
        where: eq(chunks.documentId, docId),
        columns: { id: true },
      });
      return records.length;
    });

    res.status(200).json({
      id: doc.id,
      status: doc.status,
      error: doc.error,
      version: doc.version,
      chunksIndexed: chunkCount,
    });
  },
);

// ─── GET /documents/:id/events (SSE Real-Time Status Stream) ─────────────────
documentsRouter.get(
  '/:id/events',
  authenticate,
  (req: AuthenticatedRequest, res: Response): void => {
    const user = req.user;
    const rawId = req.params['id'];
    const docId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!user || !docId) {
      res.status(400).json({ error: 'Invalid document request' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let isClosed = false;
    req.on('close', () => {
      isClosed = true;
    });

    const pollInterval = setInterval(() => {
      void (async () => {
        if (isClosed) {
          clearInterval(pollInterval);
          return;
        }

        try {
          const doc = await withTenant(user.tenantId, async (tx) => {
            return tx.query.documents.findFirst({
              where: and(eq(documents.id, docId), eq(documents.tenantId, user.tenantId)),
            });
          });

          if (!doc) {
            res.write(`data: ${JSON.stringify({ status: 'not_found' })}\n\n`);
            clearInterval(pollInterval);
            res.end();
            return;
          }

          res.write(`data: ${JSON.stringify({ status: doc.status, error: doc.error })}\n\n`);

          if (doc.status === 'ready' || doc.status === 'failed') {
            clearInterval(pollInterval);
            res.end();
          }
        } catch {
          clearInterval(pollInterval);
          res.end();
        }
      })();
    }, 1000);
  },
);

// ─── DELETE /documents/:id (Soft-Delete + Async Chunk Purge) ──────────────────
documentsRouter.delete(
  '/:id',
  authenticate,
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user;
    const rawId = req.params['id'];
    const docId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!user || !docId) {
      res.status(400).json({ error: 'Invalid document ID' });
      return;
    }

    const updated = await withTenant(user.tenantId, async (tx) => {
      const [doc] = await tx
        .update(documents)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(documents.id, docId),
            eq(documents.tenantId, user.tenantId),
            isNull(documents.deletedAt),
          ),
        )
        .returning({ id: documents.id });

      if (doc) {
        await logAuditEvent(tx, {
          tenantId: user.tenantId,
          actorId: user.sub,
          action: 'delete',
          entity: 'document',
          entityId: doc.id,
        });
      }
      return doc;
    });

    if (!updated) {
      res.status(404).json({ error: 'Document not found or already deleted' });
      return;
    }

    // Invalidate query cache for this tenant
    queryCache.invalidateTenantCorpus(user.tenantId);

    // Enqueue O(document) chunk purge job
    const boss = await getBoss();
    await boss.send('document-purge', { documentId: docId });

    res.status(200).json({
      success: true,
      message: 'Document soft-deleted and scheduled for asynchronous chunk purge',
      documentId: docId,
    });
  },
);
