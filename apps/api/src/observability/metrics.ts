import client from 'prom-client';

// Initialize Prometheus Registry
export const register = new client.Registry();

// Enable default Node.js process metrics (memory, CPU, event loop)
client.collectDefaultMetrics({ register, prefix: 'docsage_' });

// 1. Stage Latency Histogram (seconds)
export const stageLatencyHistogram = new client.Histogram({
  name: 'docsage_stage_latency_seconds',
  help: 'Latency distribution across RAG stages in seconds',
  labelNames: ['stage'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
  registers: [register],
});

// 2. Token Consumption Counter
export const tokensCounter = new client.Counter({
  name: 'docsage_tokens_total',
  help: 'Total tokens processed per tenant and model',
  labelNames: ['tenant_id', 'model', 'token_type'] as const,
  registers: [register],
});

// 3. Inference Cost Counter (USD)
export const costCounter = new client.Counter({
  name: 'docsage_cost_dollars_total',
  help: 'Total estimated LLM inference expenditure in USD',
  labelNames: ['tenant_id', 'model'] as const,
  registers: [register],
});

// 4. Stream Aborts Counter
export const streamAbortsCounter = new client.Counter({
  name: 'docsage_stream_aborts_total',
  help: 'Total client-initiated chat stream disconnections / aborts',
  labelNames: ['tenant_id'] as const,
  registers: [register],
});

// 5. Provider Errors Counter
export const providerErrorsCounter = new client.Counter({
  name: 'docsage_provider_errors_total',
  help: 'Total upstream provider exceptions and rate limit encounters',
  labelNames: ['provider', 'error_type'] as const,
  registers: [register],
});

// 6. Job Failures Counter
export const jobFailuresCounter = new client.Counter({
  name: 'docsage_job_failures_total',
  help: 'Total background queue ingestion job failures',
  labelNames: ['queue_name'] as const,
  registers: [register],
});

// 7. Cache Hit Ratio Gauge
export const cacheHitRatioGauge = new client.Gauge({
  name: 'docsage_cache_hit_ratio',
  help: 'Query cache hit ratio per tier',
  labelNames: ['tier'] as const,
  registers: [register],
});

// 8. Queue Depth Gauge
export const queueDepthGauge = new client.Gauge({
  name: 'docsage_queue_depth',
  help: 'Active pending jobs in the queue',
  labelNames: ['queue_name'] as const,
  registers: [register],
});

// 9. Retrieval Top-1 Score Distribution
export const retrievalTop1Histogram = new client.Histogram({
  name: 'docsage_retrieval_top1_score',
  help: 'Top candidate relevance score distribution',
  buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1.0],
  registers: [register],
});

export async function getMetricsText(): Promise<string> {
  return register.metrics();
}
