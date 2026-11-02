import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../index.js';
import { createAccessToken } from '../auth/service.js';
import * as quotaModule from '../reliability/quota.js';
import { queryCache } from '../reliability/cache.js';
import * as dbModule from '@docsage/db';

describe('apps/api: Chat SSE API Contract Tests', () => {
  const app = createApp();

  const userToken = createAccessToken({
    sub: '550e8400-e29b-41d4-a716-446655440010',
    tenantId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    email: 'user@enterprise.com',
    role: 'viewer',
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(quotaModule, 'checkTenantMonthlyQuota').mockResolvedValue({
      withinQuota: true,
      currentCost: 10.0,
      monthlyLimit: 100.0,
    });
  });

  it('rejects unauthenticated requests with HTTP 401', async () => {
    const res = await request(app).post('/chat').send({ message: 'Hello' });
    expect(res.status).toBe(401);
  });

  it('rejects invalid request payloads with HTTP 400', async () => {
    const res = await request(app)
      .post('/chat')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ invalidField: true });

    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toContain('Invalid chat request');
  });

  it('rejects requests when tenant monthly quota is exceeded with HTTP 402', async () => {
    vi.spyOn(quotaModule, 'checkTenantMonthlyQuota').mockResolvedValueOnce({
      withinQuota: false,
      currentCost: 105.5,
      monthlyLimit: 100.0,
    });

    const res = await request(app)
      .post('/chat')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ message: 'How do circuit breakers work?' });

    expect(res.status).toBe(402);
    expect((res.body as { error: string }).error).toContain('Monthly quota exceeded');
  });

  it('streams SSE response events from queryCache hit with meta, token, citations, and done', async () => {
    vi.spyOn(dbModule, 'withTenant').mockImplementation(async (_tenantId, fn) => {
      const mockTx = {
        execute: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: '550e8400-e29b-41d4-a716-446655440050' }]),
          }),
        }),
        query: {
          messages: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        },
      };
      return fn(mockTx as unknown as Parameters<typeof fn>[0]);
    });

    // Populate exact cache correctly with object
    queryCache.set('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'What is Raft consensus?', {
      text: 'Raft consensus decomposes state machine replication into leader election and log ordering [1].',
      citations: [
        {
          chunkId: '550e8400-e29b-41d4-a716-446655440020',
          documentId: '550e8400-e29b-41d4-a716-446655440021',
          documentTitle: 'Raft Paper',
          page: 1,
          snippet: 'Leader election algorithm',
          relevanceScore: 0.95,
        },
      ],
      totalTokens: 15,
    });

    const res = await request(app)
      .post('/chat')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ message: 'What is Raft consensus?' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('event: meta');
    expect(res.text).toContain('event: token');
    expect(res.text).toContain('event: citations');
    expect(res.text).toContain('event: done');
    expect(res.text).toContain('Raft consensus decomposes');
  });
});
