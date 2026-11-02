import crypto from 'crypto';

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string | undefined;
  name: string;
  startTimeMs: number;
  endTimeMs?: number | undefined;
  durationMs?: number | undefined;
  attributes: Record<string, string | number | boolean>;
  status: 'OK' | 'ERROR';
  error?: string | undefined;
}

export class RequestTracer {
  private spans: TraceSpan[] = [];
  public readonly traceId: string;

  constructor(traceId?: string) {
    this.traceId = traceId ?? crypto.randomUUID();
  }

  startSpan(name: string, attributes: Record<string, string | number | boolean> = {}, parentSpanId?: string): string {
    const spanId = crypto.randomUUID();
    const span: TraceSpan = {
      traceId: this.traceId,
      spanId,
      parentSpanId,
      name,
      startTimeMs: Date.now(),
      attributes,
      status: 'OK',
    };
    this.spans.push(span);
    return spanId;
  }

  endSpan(spanId: string, status: 'OK' | 'ERROR' = 'OK', error?: string): void {
    const span = this.spans.find((s) => s.spanId === spanId);
    if (span) {
      span.endTimeMs = Date.now();
      span.durationMs = span.endTimeMs - span.startTimeMs;
      span.status = status;
      if (error) {
        span.error = error;
      }
    }
  }

  async withSpan<T>(
    name: string,
    attributes: Record<string, string | number | boolean>,
    fn: () => Promise<T>,
    parentSpanId?: string,
  ): Promise<T> {
    const spanId = this.startSpan(name, attributes, parentSpanId);
    try {
      const result = await fn();
      this.endSpan(spanId, 'OK');
      return result;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.endSpan(spanId, 'ERROR', errorMsg);
      throw err;
    }
  }

  getSpans(): TraceSpan[] {
    return [...this.spans];
  }

  toOTLPFormat(): Record<string, unknown> {
    return {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'docsage-api' } },
              { key: 'telemetry.sdk.language', value: { stringValue: 'typescript' } },
            ],
          },
          scopeSpans: [
            {
              scope: { name: 'docsage-tracer' },
              spans: this.spans.map((s) => ({
                traceId: s.traceId,
                spanId: s.spanId,
                parentSpanId: s.parentSpanId,
                name: s.name,
                startTimeUnixNano: s.startTimeMs * 1_000_000,
                endTimeUnixNano: (s.endTimeMs ?? Date.now()) * 1_000_000,
                status: { code: s.status === 'OK' ? 1 : 2, message: s.error },
                attributes: Object.entries(s.attributes).map(([k, v]) => ({
                  key: k,
                  value: typeof v === 'string' ? { stringValue: v } : typeof v === 'number' ? { doubleValue: v } : { boolValue: v },
                })),
              })),
            },
          ],
        },
      ],
    };
  }
}
