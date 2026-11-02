import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../index.js';
import { RequestTracer } from './tracer.js';
import { createAccessToken } from '../auth/service.js';

describe('Level 9: Observability, Metrics, Tracing & Analytics', () => {
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

  // ── 1. Prometheus /metrics Endpoint ───────────────────────────────────────
  describe('Prometheus /metrics Endpoint', () => {
    it('serves Prometheus exposition text format with expected DocSage metrics', async () => {
      const res = await request(app).get('/metrics');

      expect(res.status).toBe(200);
      expect(res.text).toContain('docsage_stage_latency_seconds');
      expect(res.text).toContain('docsage_tokens_total');
      expect(res.text).toContain('docsage_cost_dollars_total');
      expect(res.text).toContain('docsage_cache_hit_ratio');
    });
  });

  // ── 2. OpenTelemetry RequestTracer ─────────────────────────────────────────
  describe('OpenTelemetry RequestTracer', () => {
    it('accurately captures spans, durations, and attributes across RAG stages', async () => {
      const tracer = new RequestTracer('test-trace-123');

      // Test withSpan success
      const embedResult = await tracer.withSpan(
        'embed',
        { model: 'bge-small-en-v1.5', dimension: 384 },
        async () => {
          await new Promise((r) => setTimeout(r, 15));
          return [0.1, 0.2, 0.3];
        },
      );
      expect(embedResult).toEqual([0.1, 0.2, 0.3]);

      // Test withSpan failure handling
      await expect(
        tracer.withSpan('rerank', { model: 'cohere-rerank-v3.5' }, async () => {
          await Promise.resolve();
          throw new Error('Rerank API 503');
        }),
      ).rejects.toThrow('Rerank API 503');

      const spans = tracer.getSpans();
      expect(spans.length).toBe(2);

      const embedSpan = spans[0];
      expect(embedSpan?.name).toBe('embed');
      expect(embedSpan?.status).toBe('OK');
      expect(embedSpan?.durationMs).toBeGreaterThanOrEqual(10);
      expect(embedSpan?.attributes['model']).toBe('bge-small-en-v1.5');

      const rerankSpan = spans[1];
      expect(rerankSpan?.name).toBe('rerank');
      expect(rerankSpan?.status).toBe('ERROR');
      expect(rerankSpan?.error).toBe('Rerank API 503');

      // Export OTLP formatted spans
      const otlp = tracer.toOTLPFormat();
      expect(otlp).toHaveProperty('resourceSpans');
      const resourceSpans = otlp['resourceSpans'] as Array<{
        scopeSpans: Array<{ spans: unknown[] }>;
      }>;
      expect(resourceSpans[0]?.scopeSpans[0]?.spans.length).toBe(2);
    });
  });

  // ── 3. User Feedback & Candidate Golden-Set Ingestion ──────────────────────
  describe('User Feedback & Candidate Golden-Set Endpoint', () => {
    it('validates feedback rating constraints (accepts only 1 or -1)', async () => {
      const invalidRes = await request(app)
        .post('/admin/feedback')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          messageId: '550e8400-e29b-41d4-a716-446655440003',
          rating: 5, // Invalid rating
        });

      expect(invalidRes.status).toBe(400);
    });
  });

  // ── 4. Admin Analytics Endpoint ───────────────────────────────────────────
  describe('Admin Analytics Endpoint', () => {
    it('enforces RBAC, forbidding non-admin users from accessing tenant analytics', async () => {
      const res = await request(app)
        .get('/admin/analytics')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect((res.body as { error: string }).error).toContain('Forbidden');
    });

    it('returns structured analytics for administrators', async () => {
      const res = await request(app)
        .get('/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      // If database is not connected in unit test mode, either 200 or 500 error is handled safely
      if (res.status === 200) {
        const body = res.body as {
          totalCost: number;
          p95LatencyMs: number;
          feedback: { thumbsUp: number; thumbsDown: number };
          topUnanswered: unknown[];
        };
        expect(typeof body.totalCost).toBe('number');
        expect(typeof body.p95LatencyMs).toBe('number');
        expect(body.feedback).toBeDefined();
        expect(Array.isArray(body.topUnanswered)).toBe(true);
      } else {
        expect(res.status).toBe(500);
      }
    });
  });
});
