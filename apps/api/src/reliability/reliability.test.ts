import { describe, it, expect, vi } from 'vitest';
import { CircuitBreaker, executeWithFallback } from '@docsage/rag';
import { TokenBucketLimiter, createRateLimiterMiddleware } from './rate-limiter.js';
import { MultiTierQueryCache } from './cache.js';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/middleware.js';

describe('Level 7: Reliability, Circuit Breakers, Fallbacks & Caching', () => {
  // ── 1. Circuit Breaker State Transitions ───────────────────────────────────
  describe('CircuitBreaker State Transitions', () => {
    it('starts CLOSED, trips to OPEN after 3 consecutive failures, and fast-fails', async () => {
      const breaker = new CircuitBreaker('test-primary', {
        failureThreshold: 3,
        resetTimeoutMs: 100,
        maxRetries: 0,
      });

      expect(breaker.getState()).toBe('CLOSED');

      // Failure 1
      await expect(
        breaker.executeWithRetry(async () => {
          await Promise.resolve();
          throw new Error('500 Service Unavailable');
        }),
      ).rejects.toThrow();
      expect(breaker.getState()).toBe('CLOSED');

      // Failure 2
      await expect(
        breaker.executeWithRetry(async () => {
          await Promise.resolve();
          throw new Error('500 Service Unavailable');
        }),
      ).rejects.toThrow();
      expect(breaker.getState()).toBe('CLOSED');

      // Failure 3: Trips breaker to OPEN
      await expect(
        breaker.executeWithRetry(async () => {
          await Promise.resolve();
          throw new Error('500 Service Unavailable');
        }),
      ).rejects.toThrow();
      expect(breaker.getState()).toBe('OPEN');

      // Subsequent call should fast-fail without invoking function
      const spyFn = vi.fn();
      await expect(breaker.executeWithRetry(spyFn)).rejects.toThrow(/is OPEN \(fast-fail\)/);
      expect(spyFn).not.toHaveBeenCalled();

      // Wait for resetTimeoutMs to transition to HALF_OPEN
      await new Promise((r) => setTimeout(r, 120));
      expect(breaker.getState()).toBe('HALF_OPEN');

      // Successful probe in HALF_OPEN resets breaker to CLOSED
      const result = await breaker.executeWithRetry(async () => {
        await Promise.resolve();
        return 'recovered';
      });
      expect(result).toBe('recovered');
      expect(breaker.getState()).toBe('CLOSED');
    });
  });

  // ── 2. Chaos-Style Provider Fallback Simulation (Groq -> Gemini -> Degraded) ────────
  describe('Multi-Provider Fallback Chain (Groq -> Gemini -> Passages)', () => {
    it('automatically fails over to Gemini when Groq encounters 429 rate limit', async () => {
      const primaryBreaker = new CircuitBreaker('groq', { maxRetries: 0 });
      const secondaryBreaker = new CircuitBreaker('gemini', { maxRetries: 0 });

      const failingGroq429 = async () => {
        await Promise.resolve();
        throw new Error('429 Too Many Requests: Rate limit exceeded');
      };

      const healthyGemini = async () => {
        await Promise.resolve();
        return 'Successful synthesis from Gemini fallback provider';
      };

      const result = await executeWithFallback(
        failingGroq429,
        healthyGemini,
        ['Passage 1 content', 'Passage 2 content'],
        primaryBreaker,
        secondaryBreaker,
      );

      expect(result.degraded).toBe(false);
      expect(result.providerUsed).toBe('gemini');
      expect(result.text).toBe('Successful synthesis from Gemini fallback provider');
    });

    it('fails over to Gemini when Groq encounters 504 timeout or 500 error', async () => {
      const primaryBreaker = new CircuitBreaker('groq', { maxRetries: 0 });
      const secondaryBreaker = new CircuitBreaker('gemini', { maxRetries: 0 });

      const failingGroq5xx = async () => {
        await Promise.resolve();
        throw new Error('504 Gateway Timeout: Upstream inference socket hung up');
      };

      const healthyGemini = async () => {
        await Promise.resolve();
        return 'Gemini response after Groq timeout';
      };

      const result = await executeWithFallback(
        failingGroq5xx,
        healthyGemini,
        ['Passage 1 content'],
        primaryBreaker,
        secondaryBreaker,
      );

      expect(result.degraded).toBe(false);
      expect(result.providerUsed).toBe('gemini');
      expect(result.text).toBe('Gemini response after Groq timeout');
    });

    it('falls back to raw retrieved passages when both Groq and Gemini are down', async () => {
      const primaryBreaker = new CircuitBreaker('groq', { maxRetries: 0 });
      const secondaryBreaker = new CircuitBreaker('gemini', { maxRetries: 0 });

      const failingGroq = async () => {
        await Promise.resolve();
        throw new Error('504 Gateway Timeout');
      };
      const failingGemini = async () => {
        await Promise.resolve();
        throw new Error('503 Service Unavailable');
      };

      const passages = [
        'Raft consensus enforces leader election using randomized timeouts.',
        'HNSW builds multi-layer proximity graphs for vector retrieval.',
      ];

      const result = await executeWithFallback(
        failingGroq,
        failingGemini,
        passages,
        primaryBreaker,
        secondaryBreaker,
      );

      expect(result.degraded).toBe(true);
      expect(result.providerUsed).toBe('fallback-passages');
      expect(result.text).toContain('AI synthesis unavailable (all upstream providers degraded)');
      expect(result.text).toContain('Raft consensus enforces leader election');
      expect(result.text).toContain('HNSW builds multi-layer proximity graphs');
    });
  });

  // ── 3. Token Bucket Rate Limiter ───────────────────────────────────────────
  describe('TokenBucketLimiter', () => {
    it('allows requests within capacity and rejects with Retry-After when exhausted', () => {
      const limiter = new TokenBucketLimiter(3, 1); // 3 tokens, 1 token/sec refill
      const key = 'user:test-123';

      expect(limiter.consume(key).allowed).toBe(true);
      expect(limiter.consume(key).allowed).toBe(true);
      expect(limiter.consume(key).allowed).toBe(true);

      // 4th request must be rejected
      const rejected = limiter.consume(key);
      expect(rejected.allowed).toBe(false);
      expect(rejected.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    });

    it('enforces rate limiter express middleware for users and tenants', () => {
      const middleware = createRateLimiterMiddleware({
        userCapacity: 1,
        tenantCapacity: 1,
        refillPerMinute: 60,
      });

      const next = vi.fn();
      const mockRes = () => {
        const res: Record<string, unknown> = {};
        res.setHeader = vi.fn();
        res.status = vi.fn().mockReturnValue(res);
        res.json = vi.fn().mockReturnValue(res);
        return res as unknown as Response;
      };

      // 1. Unauthenticated request passes through
      middleware({} as unknown as AuthenticatedRequest, mockRes(), next);
      expect(next).toHaveBeenCalledTimes(1);

      // 2. First authenticated request allowed
      const req = {
        user: { sub: 'u1', tenantId: 't1' },
      } as unknown as AuthenticatedRequest;
      middleware(req, mockRes(), next);
      expect(next).toHaveBeenCalledTimes(2);

      // 3. Second request fails user limit
      const userExceededRes = mockRes();
      middleware(req, userExceededRes, next);
      expect(userExceededRes.status).toHaveBeenCalledWith(429);
      expect(userExceededRes.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));

      // 4. Request from different user in same tenant fails tenant limit
      const tenantReq = {
        user: { sub: 'u2', tenantId: 't1' },
      } as unknown as AuthenticatedRequest;
      const tenantExceededRes = mockRes();
      middleware(tenantReq, tenantExceededRes, next);
      expect(tenantExceededRes.status).toHaveBeenCalledWith(429);
    });
  });

  // ── 4. Multi-Tier Query & Semantic Caching ─────────────────────────────────
  describe('MultiTierQueryCache', () => {
    it('hits exact-cache for identical queries and semantic-cache for similar queries', () => {
      const cache = new MultiTierQueryCache();
      const tenantId = '00000000-0000-0000-0000-000000000001';
      const query = 'What is the Raft election timeout range?';
      const embedding = [0.1, 0.2, 0.3, 0.4]; // 4-dim unit vector

      const mockResult = {
        text: 'Raft election timeouts range from 150ms to 300ms [1].',
        citations: [],
        totalTokens: 25,
      };

      // Initial miss
      expect(cache.get(tenantId, query, embedding)).toBeNull();

      // Store in cache
      cache.set(tenantId, query, mockResult, embedding);

      // Exact Hit
      const exactHit = cache.get(tenantId, query, embedding);
      expect(exactHit).not.toBeNull();
      expect(exactHit?.source).toBe('exact-cache');
      expect(exactHit?.text).toBe(mockResult.text);

      // Semantic Hit (cosine similarity >= 0.98)
      const slightlyDifferentQuery = 'Explain Raft election timeouts';
      const highlySimilarEmbedding = [0.1, 0.2, 0.3, 0.399]; // cosine > 0.999
      const semanticHit = cache.get(tenantId, slightlyDifferentQuery, highlySimilarEmbedding);
      expect(semanticHit).not.toBeNull();
      expect(semanticHit?.source).toBe('semantic-cache');

      // Cache Invalidation on Corpus Mutation
      cache.invalidateTenantCorpus(tenantId);
      expect(cache.get(tenantId, query, embedding)).toBeNull();

      const metrics = cache.getMetrics();
      expect(metrics.exactHits).toBe(1);
      expect(metrics.semanticHits).toBe(1);
      expect(metrics.misses).toBe(2);
      expect(metrics.hitRatio).toBe(0.5);
    });
  });
});
