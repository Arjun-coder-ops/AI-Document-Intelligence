# ADR 0009: OpenTelemetry Tracing, Prometheus Metrics, and Observability Architecture

## Status

Accepted

## Context

A production enterprise RAG pipeline comprises distinct sequential and parallel stages:

1. Query embedding generation
2. Dense HNSW vector search
3. Lexical GIN full-text search
4. Reciprocal Rank Fusion (RRF)
5. Cross-Encoder reranking
6. Upstream LLM streaming (Time to First Token + token generation)
7. Citation verification and parsing

When end-to-end latency increases or user queries fail, traditional log statements are insufficient to distinguish between database index contention, network latency to external AI APIs, or slow LLM generation. Furthermore, operational engineering requires real-time monitoring of tenant spend, cache efficiency, and queue backlog.

## Decision

1. **Structured JSON Logging with Pino:**
   - Deployed `pino` with ISO timestamps and standard contextual correlation: `requestId`, `tenantId`, `userId`, `method`, `route`, `statusCode`, and `durationMs`.
   - **Zero Content Logging:** Raw query strings, retrieved chunk texts, and generated answers are strictly excluded from logs to prevent PII and enterprise confidential data leakage.

2. **OpenTelemetry-Compatible Request Tracing:**
   - Implemented `RequestTracer` generating hierarchical spans across RAG stages: `embed`, `dense_search`, `lexical_search`, `fusion`, `rerank`, `llm_ttft`, `llm_total`, `db_query`.
   - Formatted as standard OTLP JSON (`resourceSpans`), enabling direct ingestion by Grafana Tempo, Jaeger, and Datadog without custom adapters.

3. **Prometheus Metrics (/metrics):**
   - Implemented standard Prometheus text exposition format via `prom-client`.
   - **Histograms:** `docsage_stage_latency_seconds` with stage labels, and `docsage_retrieval_top1_score` tracking retrieval confidence distributions.
   - **Counters:** `docsage_tokens_total` and `docsage_cost_dollars_total` sliced by tenant and model; `docsage_stream_aborts_total` tracking client cancellations; `docsage_provider_errors_total` tracking rate limits.
   - **Gauges:** `docsage_cache_hit_ratio` and `docsage_queue_depth`.

4. **Admin Analytics & Closed-Loop Evaluation:**
   - Exposed `GET /admin/analytics` computing aggregate tenant spend, $p50$ and $p95$ latencies using PostgreSQL `percentile_cont`, and top unanswered queries.
   - Deployed `POST /admin/feedback`: user thumbs-down ratings (`rating = -1`) are recorded and flagged as candidate golden-set entries to continuously enrich the evaluation corpus.

5. **Infrastructure Dashboards:**
   - Committed Grafana dashboard definition in `infra/grafana/docsage-overview.json`.

## Consequences

- End-to-end trace breakdown enables immediate root-cause diagnosis of latency regressions.
- Financial observability with tenant-level cost tracking ensures compliance with monthly spend quotas.
- Real-time visibility into cache performance and client disconnection behavior.
