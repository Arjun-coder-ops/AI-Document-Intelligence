import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../index.js';
import { createAccessToken } from '../auth/service.js';
import * as dbModule from '@docsage/db';
import { DEMO_TENANT_ID } from '@docsage/shared';

describe('apps/api: Documents API Contract Tests', () => {
  const app = createApp();

  const editorToken = createAccessToken({
    sub: '550e8400-e29b-41d4-a716-446655440010',
    tenantId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    email: 'editor@enterprise.com',
    role: 'editor',
  });

  const viewerToken = createAccessToken({
    sub: '550e8400-e29b-41d4-a716-446655440011',
    tenantId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    email: 'viewer@enterprise.com',
    role: 'viewer',
  });

  const demoEditorToken = createAccessToken({
    sub: '550e8400-e29b-41d4-a716-446655440099',
    tenantId: DEMO_TENANT_ID,
    email: 'demo-editor@docsage.io',
    role: 'editor',
  });

  describe('POST /documents (Upload)', () => {
    it('requires authentication and rejects with HTTP 401 when token missing', async () => {
      const res = await request(app).post('/documents');
      expect(res.status).toBe(401);
    });

    it('enforces RBAC, forbidding viewer role from uploading documents', async () => {
      const res = await request(app)
        .post('/documents')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect((res.body as { error: string }).error).toContain('Forbidden');
    });

    it('rejects uploads from the demo tenant with HTTP 403 Forbidden even with editor token', async () => {
      const res = await request(app)
        .post('/documents')
        .set('Authorization', `Bearer ${demoEditorToken}`)
        .send({});

      expect(res.status).toBe(403);
      expect((res.body as { error: string }).error).toContain('Demo tenant is read-only');
    });

    it('rejects upload with no multipart file payload', async () => {
      const res = await request(app)
        .post('/documents')
        .set('Authorization', `Bearer ${editorToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('rejects files without valid PDF magic bytes (%PDF-)', async () => {
      const corruptBuffer = Buffer.from('NOT_A_PDF_FILE_HEADER_TEXT');

      const res = await request(app)
        .post('/documents')
        .set('Authorization', `Bearer ${editorToken}`)
        .attach('file', corruptBuffer, 'corrupt.pdf');

      expect(res.status).toBe(400);
      expect((res.body as { error: string }).error).toContain('%PDF-');
    });

    it('identifies duplicate document upload and returns existing record idempotently', async () => {
      vi.spyOn(dbModule, 'withTenant').mockImplementation(async (_tenantId, fn) => {
        const mockTx = {
          query: {
            documents: {
              findFirst: vi.fn().mockResolvedValue({
                id: '550e8400-e29b-41d4-a716-446655440001',
                status: 'ready',
                version: 1,
              }),
            },
          },
        };
        return fn(mockTx as unknown as Parameters<typeof fn>[0]);
      });

      const validPdfBuffer = Buffer.concat([
        Buffer.from('%PDF-1.4\n%âãÏÓ\n'),
        Buffer.from('Mock PDF document content payload'),
      ]);

      const res = await request(app)
        .post('/documents')
        .set('Authorization', `Bearer ${editorToken}`)
        .attach('file', validPdfBuffer, 'architecture.pdf');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('isDuplicate', true);
      expect(res.body).toHaveProperty('documentId', '550e8400-e29b-41d4-a716-446655440001');
    });
  });

  describe('GET /documents (List)', () => {
    it('requires authentication', async () => {
      const res = await request(app).get('/documents');
      expect(res.status).toBe(401);
    });

    it('returns tenant document collection for authenticated viewer', async () => {
      vi.spyOn(dbModule, 'withTenant').mockImplementation(async (_tenantId, fn) => {
        const mockTx = {
          query: {
            documents: {
              findMany: vi.fn().mockResolvedValue([
                {
                  id: '550e8400-e29b-41d4-a716-446655440001',
                  title: 'System Architecture',
                  filename: 'architecture.pdf',
                  status: 'ready',
                  createdAt: new Date(),
                },
              ]),
            },
          },
        };
        return fn(mockTx as unknown as Parameters<typeof fn>[0]);
      });

      const res = await request(app)
        .get('/documents')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total', 1);
      expect((res.body as { documents: unknown[] }).documents).toHaveLength(1);
    });
  });

  describe('GET /documents/:id/status', () => {
    it('requires authentication', async () => {
      const res = await request(app).get('/documents/550e8400-e29b-41d4-a716-446655440000/status');
      expect(res.status).toBe(401);
    });

    it('returns 404 when document is not found', async () => {
      vi.spyOn(dbModule, 'withTenant').mockImplementation(async (_tenantId, fn) => {
        const mockTx = {
          query: {
            documents: {
              findFirst: vi.fn().mockResolvedValue(null),
            },
          },
        };
        return fn(mockTx as unknown as Parameters<typeof fn>[0]);
      });

      const res = await request(app)
        .get('/documents/550e8400-e29b-41d4-a716-446655440000/status')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(404);
    });

    it('returns 200 with document status and chunk count', async () => {
      vi.spyOn(dbModule, 'withTenant').mockImplementation(async (_tenantId, fn) => {
        const mockTx = {
          query: {
            documents: {
              findFirst: vi.fn().mockResolvedValue({
                id: '550e8400-e29b-41d4-a716-446655440001',
                status: 'ready',
                error: null,
                version: 1,
              }),
            },
            chunks: {
              findMany: vi.fn().mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]),
            },
          },
        };
        return fn(mockTx as unknown as Parameters<typeof fn>[0]);
      });

      const res = await request(app)
        .get('/documents/550e8400-e29b-41d4-a716-446655440001/status')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ready');
      expect(res.body).toHaveProperty('chunksIndexed', 2);
    });
  });

  describe('DELETE /documents/:id', () => {
    it('enforces RBAC, forbidding viewer from deleting documents', async () => {
      const res = await request(app)
        .delete('/documents/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect((res.body as { error: string }).error).toContain('Forbidden');
    });

    it('rejects document deletion from the demo tenant with HTTP 403 Forbidden even with editor token', async () => {
      const res = await request(app)
        .delete('/documents/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${demoEditorToken}`);

      expect(res.status).toBe(403);
      expect((res.body as { error: string }).error).toContain('Demo tenant is read-only');
    });

    it('returns 404 when document to delete is not found', async () => {
      vi.spyOn(dbModule, 'withTenant').mockImplementation(async (_tenantId, fn) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        };
        return fn(mockTx as unknown as Parameters<typeof fn>[0]);
      });

      const res = await request(app)
        .delete('/documents/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${editorToken}`);

      expect(res.status).toBe(404);
    });
  });
});
