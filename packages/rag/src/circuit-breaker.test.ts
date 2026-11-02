import { describe, it, expect, vi } from 'vitest';
import { CircuitBreaker, executeWithFallback } from './circuit-breaker.js';

describe('packages/rag: CircuitBreaker & Fallback Chain', () => {
  it('manages CLOSED, OPEN, HALF_OPEN transitions', async () => {
    const cb = new CircuitBreaker('test-cb', {
      failureThreshold: 2,
      resetTimeoutMs: 50,
      maxRetries: 0,
    });

    expect(cb.getState()).toBe('CLOSED');

    // Failure 1
    await expect(
      cb.executeWithRetry(async () => {
        await Promise.resolve();
        throw new Error('500 Fail');
      }),
    ).rejects.toThrow();
    expect(cb.getState()).toBe('CLOSED');

    // Failure 2 -> OPEN
    await expect(
      cb.executeWithRetry(async () => {
        await Promise.resolve();
        throw new Error('500 Fail');
      }),
    ).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');

    // Fast-fail in OPEN
    const spy = vi.fn();
    await expect(cb.executeWithRetry(spy)).rejects.toThrow(/fast-fail/);
    expect(spy).not.toHaveBeenCalled();

    // Transition to HALF_OPEN after reset timeout
    await new Promise((r) => setTimeout(r, 60));
    expect(cb.getState()).toBe('HALF_OPEN');

    // Success in HALF_OPEN resets to CLOSED
    const res = await cb.executeWithRetry(async () => {
      await Promise.resolve();
      return 'recovered';
    });
    expect(res).toBe('recovered');
    expect(cb.getState()).toBe('CLOSED');
  });

  it('retries with exponential backoff on intermittent errors', async () => {
    const cb = new CircuitBreaker('retry-cb', {
      failureThreshold: 5,
      maxRetries: 2,
      baseDelayMs: 10,
      maxDelayMs: 50,
    });

    let attempts = 0;
    const result = await cb.executeWithRetry(async () => {
      await Promise.resolve();
      attempts++;
      if (attempts < 2) {
        throw new Error('Temporary 503');
      }
      return 'success-after-retry';
    });

    expect(result).toBe('success-after-retry');
    expect(attempts).toBe(2);
  });

  it('fails over through primary -> secondary -> fallback passages', async () => {
    const primary = new CircuitBreaker('primary', { maxRetries: 0 });
    const secondary = new CircuitBreaker('secondary', { maxRetries: 0 });

    const fail = async () => {
      await Promise.resolve();
      throw new Error('Downstream failure');
    };

    const res = await executeWithFallback(
      fail,
      fail,
      ['Passage A', 'Passage B'],
      primary,
      secondary,
    );

    expect(res.degraded).toBe(true);
    expect(res.providerUsed).toBe('fallback-passages');
    expect(res.text).toContain('AI synthesis unavailable');
    expect(res.text).toContain('Passage A');
  });
});
