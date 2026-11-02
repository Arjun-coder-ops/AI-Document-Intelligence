import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../index.js';
import { createAccessToken } from '../auth/service.js';
import * as dbModule from '@docsage/db';

describe('apps/api: Admin & Feedback Routes', () => {
  const app = createApp();

  const adminToken = createAccessToken({
    sub: '550e8400-e29b-41d4-a716-446655440001',
    tenantId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    email: 'admin@enterprise.com',
    role: 'admin',
  });

  const viewerToken = createAccessToken({
    sub: '550e8400-e29b-41d4-a716-446655440002',
    tenantId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    email: 'viewer@enterprise.com',
    role: 'viewer',
  });

  describe('GET /admin/analytics', () => {
    it('returns 403 for non-admin users', async () => {
      const res = await request(app)
        .get('/admin/analytics')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });

    it('returns aggregated analytics metrics for admin users', async () => {
      vi.spyOn(dbModule, 'withTenant').mockImplementation(async (_tenantId, fn) => {
        const mockTx = {
          execute: vi
            .fn()
            .mockResolvedValueOnce([{ total_cost: '14.825000', total_messages: '120' }])
            .mockResolvedValueOnce([{ p95_latency_ms: 240, p50_latency_ms: 110 }])
            .mockResolvedValueOnce([{ thumbs_up: '45', thumbs_down: '3' }]),
          query: {
            messages: {
              findMany: vi.fn().mockResolvedValue([
                {
                  id: '550e8400-e29b-41d4-a716-446655440099',
                  role: 'assistant',
                  content: 'Passage not found in corpus',
                  citations: [],
                  createdAt: new Date(),
                },
              ]),
            },
          },
        };
        return fn(mockTx as unknown as Parameters<typeof fn>[0]);
      });

      const res = await request(app)
        .get('/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalCost', 14.825);
      expect(res.body).toHaveProperty('totalMessages', 120);
      expect(res.body).toHaveProperty('p95LatencyMs', 240);
      expect(res.body).toHaveProperty('p50LatencyMs', 110);
      expect(res.body).toHaveProperty('feedback');
      expect((res.body as { feedback: { thumbsUp: number } }).feedback.thumbsUp).toBe(45);
      expect((res.body as { topUnanswered: unknown[] }).topUnanswered).toHaveLength(1);
    });
  });

  describe('POST /admin/feedback', () => {
    it('records thumbs-up feedback successfully', async () => {
      vi.spyOn(dbModule, 'withTenant').mockImplementation(async (_tenantId, fn) => {
        const mockTx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: '550e8400-e29b-41d4-a716-446655440088' }]),
            }),
          }),
        };
        return fn(mockTx as unknown as Parameters<typeof fn>[0]);
      });

      const res = await request(app)
        .post('/admin/feedback')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          messageId: '550e8400-e29b-41d4-a716-446655440055',
          rating: 1,
          comment: 'Very helpful and accurate citation.',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('isCandidateGolden', false);
    });

    it('queues thumbs-down feedback as candidate golden-set entry', async () => {
      vi.spyOn(dbModule, 'withTenant').mockImplementation(async (_tenantId, fn) => {
        const mockTx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: '550e8400-e29b-41d4-a716-446655440089' }]),
            }),
          }),
        };
        return fn(mockTx as unknown as Parameters<typeof fn>[0]);
      });

      const res = await request(app)
        .post('/admin/feedback')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          messageId: '550e8400-e29b-41d4-a716-446655440055',
          rating: -1,
          comment: 'Hallucinated details regarding index configuration.',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('isCandidateGolden', true);
      expect((res.body as { message: string }).message).toContain('candidate golden-set');
    });
  });
});
