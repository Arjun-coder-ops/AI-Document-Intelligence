import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../auth/middleware.js';

interface BucketState {
  tokens: number;
  lastRefill: number; // timestamp in ms
}

export class TokenBucketLimiter {
  private buckets = new Map<string, BucketState>();

  constructor(
    public readonly capacity: number, // maximum tokens
    public readonly refillPerSecond: number, // refill rate
  ) {}

  consume(key: string, tokensRequested = 1): { allowed: boolean; retryAfterSeconds: number } {
    const now = Date.now();
    let state = this.buckets.get(key);

    if (!state) {
      state = { tokens: this.capacity, lastRefill: now };
      this.buckets.set(key, state);
    } else {
      // Calculate refilled tokens based on elapsed time
      const elapsedSeconds = (now - state.lastRefill) / 1000;
      state.tokens = Math.min(this.capacity, state.tokens + elapsedSeconds * this.refillPerSecond);
      state.lastRefill = now;
    }

    if (state.tokens >= tokensRequested) {
      state.tokens -= tokensRequested;
      return { allowed: true, retryAfterSeconds: 0 };
    }

    // Calculate time until enough tokens are replenished
    const needed = tokensRequested - state.tokens;
    const retryAfterSeconds = Math.max(1, Math.ceil(needed / this.refillPerSecond));

    return { allowed: false, retryAfterSeconds };
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }
}

export function createRateLimiterMiddleware(options: {
  userCapacity: number;
  tenantCapacity: number;
  refillPerMinute: number;
}) {
  const refillPerSec = options.refillPerMinute / 60;
  const userLimiter = new TokenBucketLimiter(options.userCapacity, refillPerSec);
  const tenantLimiter = new TokenBucketLimiter(options.tenantCapacity, refillPerSec * 4);

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      next();
      return;
    }

    // 1. Check user token bucket
    const userResult = userLimiter.consume(`user:${user.sub}`);
    if (!userResult.allowed) {
      res.setHeader('Retry-After', String(userResult.retryAfterSeconds));
      res.status(429).json({
        error: 'Too Many Requests: User rate limit exceeded',
        retryAfterSeconds: userResult.retryAfterSeconds,
      });
      return;
    }

    // 2. Check tenant token bucket
    const tenantResult = tenantLimiter.consume(`tenant:${user.tenantId}`);
    if (!tenantResult.allowed) {
      res.setHeader('Retry-After', String(tenantResult.retryAfterSeconds));
      res.status(429).json({
        error: 'Too Many Requests: Tenant rate limit exceeded',
        retryAfterSeconds: tenantResult.retryAfterSeconds,
      });
      return;
    }

    next();
  };
}

export function createIpRateLimiterMiddleware(options: {
  capacity: number;
  refillPerMinute: number;
}) {
  const refillPerSec = options.refillPerMinute / 60;
  const ipLimiter = new TokenBucketLimiter(options.capacity, refillPerSec);

  return (req: Request, res: Response, next: NextFunction): void => {
    // In test environment, bypass unless test explicitly tests rate limiting
    if (process.env['NODE_ENV'] === 'test' && !req.headers['x-test-rate-limit']) {
      next();
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const result = ipLimiter.consume(`ip:${ip}`);
    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
      res.status(429).json({
        error: 'Too Many Requests: Rate limit exceeded for login attempts',
        retryAfterSeconds: result.retryAfterSeconds,
      });
      return;
    }

    next();
  };
}
