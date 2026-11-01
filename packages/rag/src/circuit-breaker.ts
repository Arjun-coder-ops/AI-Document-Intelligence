export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number; // consecutive failures before tripping to OPEN (default 3)
  resetTimeoutMs?: number; // time to stay OPEN before testing HALF_OPEN (default 5000ms)
  maxRetries?: number; // retry attempts per request (default 2)
  baseDelayMs?: number; // initial backoff delay (default 100ms)
  maxDelayMs?: number; // max backoff delay (default 1000ms)
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private nextAttemptTime = 0;

  public readonly failureThreshold: number;
  public readonly resetTimeoutMs: number;
  public readonly maxRetries: number;
  public readonly baseDelayMs: number;
  public readonly maxDelayMs: number;

  constructor(
    public readonly name: string,
    options: CircuitBreakerOptions = {},
  ) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 5000;
    this.maxRetries = options.maxRetries ?? 2;
    this.baseDelayMs = options.baseDelayMs ?? 100;
    this.maxDelayMs = options.maxDelayMs ?? 1000;
  }

  getState(): CircuitState {
    if (this.state === 'OPEN' && Date.now() >= this.nextAttemptTime) {
      this.state = 'HALF_OPEN';
    }
    return this.state;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  recordFailure(): void {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold || this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.resetTimeoutMs;
    }
  }

  async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();
    if (currentState === 'OPEN') {
      throw new Error(`CircuitBreaker[${this.name}] is OPEN (fast-fail)`);
    }

    let attempt = 0;
    while (true) {
      try {
        const result = await fn();
        this.recordSuccess();
        return result;
      } catch (err: unknown) {
        attempt++;
        if (attempt > this.maxRetries) {
          this.recordFailure();
          throw err;
        }

        // Exponential backoff with full jitter: random(0, min(maxDelay, baseDelay * 2^attempt))
        const expDelay = Math.min(this.maxDelayMs, this.baseDelayMs * Math.pow(2, attempt - 1));
        const jitterDelay = Math.floor(Math.random() * expDelay);
        await new Promise<void>((resolve) => setTimeout(resolve, jitterDelay));
      }
    }
  }
}

export interface FallbackChainResult {
  text: string;
  providerUsed: string;
  degraded: boolean;
}

export async function executeWithFallback(
  primaryFn: () => Promise<string>,
  secondaryFn: () => Promise<string>,
  fallbackPassages: string[],
  primaryBreaker: CircuitBreaker,
  secondaryBreaker: CircuitBreaker,
): Promise<FallbackChainResult> {
  // 1. Attempt Primary Provider
  try {
    const result = await primaryBreaker.executeWithRetry(primaryFn);
    return {
      text: result,
      providerUsed: primaryBreaker.name,
      degraded: false,
    };
  } catch (primaryErr) {
    console.warn(`Primary provider [${primaryBreaker.name}] failed:`, primaryErr instanceof Error ? primaryErr.message : primaryErr);
  }

  // 2. Attempt Secondary Fallback Provider
  try {
    const result = await secondaryBreaker.executeWithRetry(secondaryFn);
    return {
      text: result,
      providerUsed: secondaryBreaker.name,
      degraded: false,
    };
  } catch (secondaryErr) {
    console.warn(`Secondary provider [${secondaryBreaker.name}] failed:`, secondaryErr instanceof Error ? secondaryErr.message : secondaryErr);
  }

  // 3. Final Degradation: return raw retrieved passages
  const passagesSummary = fallbackPassages.length > 0
    ? fallbackPassages.map((p, i) => `[${i + 1}] ${p}`).join('\n\n')
    : 'No relevant passages retrieved.';

  const degradedText = `AI synthesis unavailable (all upstream providers degraded). Here are the relevant passages from your documents:\n\n${passagesSummary}`;

  return {
    text: degradedText,
    providerUsed: 'fallback-passages',
    degraded: true,
  };
}
