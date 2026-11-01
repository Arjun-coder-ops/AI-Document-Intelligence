import { describe, it, expect, vi } from 'vitest';
import { CircuitBreaker, executeWithFallback } from '@docsage/rag';
import { TokenBucketLimiter } from './rate-limiter.js';
import { MultiTierQueryCache } from './cache.js';

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

  // ── 2. Chaos-Style Provider Fallback Simulation ────────────────────────────
  describe('Multi-Provider Fallback Chain', () => {
    it('automatically fails over to secondary provider when primary encounters 429 rate limit', async () => {
      const primaryBreaker = new CircuitBreaker('groq', { maxRetries: 0 });
      const secondaryBreaker = new CircuitBreaker('gemini', { maxRetries: 0 });

      const failingPrimary = async () => {
        await Promise.resolve();
        const err = new Error('429 Too Many Requests: Rate limit exceeded');
        throw err;
      };

      const healthySecondary = async () => {
        await Promise.resolve();
        return 'Successful synthesis from secondary provider';
      };

      const result = await executeWithFallback(
        failingPrimary,
        healthySecondary,
        ['Passage 1 content', 'Passage 2 content'],
        primaryBreaker,
        secondaryBreaker,
      );

      expect(result.degraded).toBe(false);
      expect(result.providerUsed).toBe('gemini');
      expect(result.text).toBe('Successful synthesis from secondary provider');
    });

    it('falls back to raw retrieved passages when all upstream providers are degraded', async () => {
      const primaryBreaker = new CircuitBreaker('groq', { maxRetries: 0 });
      const secondaryBreaker = new CircuitBreaker('openai', { maxRetries: 0 });

      const failingPrimary = async () => {
        await Promise.resolve();
        throw new Error('504 Gateway Timeout');
      };
      const failingSecondary = async () => {
        await Promise.resolve();
        throw new Error('503 Service Unavailable');
      };

      const passages = [
        'Raft consensus enforces leader election using randomized timeouts.',
        'HNSW builds multi-layer proximity graphs for vector retrieval.',
      ];

      const result = await executeWithFallback(
        failingPrimary,
        failingSecondary,
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
