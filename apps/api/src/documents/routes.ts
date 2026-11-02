import { Router, type Response } from 'express';
import { documents, chunks, withTenant } from '@docsage/db';
import { eq, and, isNull } from 'drizzle-orm';
import { DEMO_TENANT_ID } from '@docsage/shared';
import { authenticate, requireRole, type AuthenticatedRequest } from '../auth/middleware.js';
import { logAuditEvent } from '../audit/service.js';
import { createRateLimiterMiddleware } from '../reliability/rate-limiter.js';
import { queryCache } from '../reliability/cache.js';
import { handlePdfUpload, getBoss } from './upload.js';

export const documentsRouter: Router = Router();

const uploadRateLimiter = createRateLimiterMiddleware({
  userCapacity: 5,
  tenantCapacity: 20,
  refillPerMinute: 10,
});

// ─── POST /documents (Streaming PDF Upload) ──────────────────────────────────
documentsRouter.post(
  '/',
  authenticate,
  requireRole('editor'),
  uploadRateLimiter,
  (req: AuthenticatedRequest, res: Response): void => {
    if (req.user?.tenantId === DEMO_TENANT_ID) {
      res.status(403).json({ error: 'Demo tenant is read-only. Document upload is prohibited.' });
      return;
    }
    handlePdfUpload(req, res);
  },
);

// ─── GET /documents (List Tenant Documents) ──────────────────────────────────
documentsRouter.get(
  '/',
  authenticate,
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    try {
      const page = Math.max(1, parseInt((req.query['page'] as string) || '1', 10));
      const limit = Math.min(
        100,
        Math.max(1, parseInt((req.query['limit'] as string) || '20', 10)),
      );
      const offset = (page - 1) * limit;

      const results = await withTenant(user.tenantId, async (tx) => {
        return tx.query.documents.findMany({
          where: and(eq(documents.tenantId, user.tenantId), isNull(documents.deletedAt)),
          orderBy: (table, { desc }) => [desc(table.createdAt)],
          limit,
          offset,
        });
      });

      res.status(200).json({
        documents: results,
        total: results.length,
        page,
        limit,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database query failure';
      res.status(500).json({ error: msg });
    }
  },
);

// ─── GET /documents/:id/status (Poll Processing Status) ───────────────────────
documentsRouter.get(
  '/:id/status',
  authenticate,
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const rawId = req.params['id'];
    const docId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!docId) {
      res.status(400).json({ error: 'Document ID required' });
      return;
    }

    try {
      const doc = await withTenant(user.tenantId, async (tx) => {
        return tx.query.documents.findFirst({
          where: and(
            eq(documents.id, docId),
            eq(documents.tenantId, user.tenantId),
            isNull(documents.deletedAt),
          ),
        });
      });

      if (!doc) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

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
        error:
          (doc as { errorMessage?: string; error?: string }).errorMessage ??
          (doc as { errorMessage?: string; error?: string }).error ??
          null,
        version: doc.version,
        chunksIndexed: chunkCount,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Status query error';
      res.status(500).json({ error: msg });
    }
  },
);

// ─── GET /documents/:id (Get Document Details with Chunks) ───────────────────
documentsRouter.get(
  '/:id',
  authenticate,
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const rawId = req.params['id'];
    const docId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!docId) {
      res.status(400).json({ error: 'Document ID required' });
      return;
    }

    try {
      const doc = await withTenant(user.tenantId, async (tx) => {
        return tx.query.documents.findFirst({
          where: and(
            eq(documents.id, docId),
            eq(documents.tenantId, user.tenantId),
            isNull(documents.deletedAt),
          ),
        });
      });

      if (!doc) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      const docChunks = await withTenant(user.tenantId, async (tx) => {
        return tx.query.chunks.findMany({
          where: eq(chunks.documentId, docId),
          columns: {
            id: true,
            ordinal: true,
            content: true,
            page: true,
            tokenCount: true,
          },
        });
      });

      res.status(200).json({
        ...doc,
        chunks: docChunks,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Document retrieval error';
      res.status(500).json({ error: msg });
    }
  },
);

// ─── DELETE /documents/:id (Soft-Delete & Purge Queue) ────────────────────────
documentsRouter.delete(
  '/:id',
  authenticate,
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (user.tenantId === DEMO_TENANT_ID) {
      res.status(403).json({ error: 'Demo tenant is read-only. Document deletion is prohibited.' });
      return;
    }

    const rawId = req.params['id'];
    const docId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!docId) {
      res.status(400).json({ error: 'Document ID required' });
      return;
    }

    try {
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
          .returning();

        if (doc) {
          await logAuditEvent(tx, {
            tenantId: user.tenantId,
            actorId: user.sub ?? (user as { userId?: string }).userId ?? null,
            action: 'delete',
            entity: 'document',
            entityId: docId,
          });
        }
        return doc;
      });

      if (!updated) {
        res.status(404).json({ error: 'Document not found or already deleted' });
        return;
      }

      queryCache.invalidateTenantCorpus(user.tenantId);

      const boss = await getBoss();
      const purgeJobId = await boss.send('document-purge', {
        documentId: docId,
        tenantId: user.tenantId,
      });

      res.status(200).json({
        message: 'Document soft-deleted successfully; background purge scheduled',
        documentId: docId,
        purgeJobId,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Document deletion error';
      res.status(500).json({ error: msg });
    }
  },
);
