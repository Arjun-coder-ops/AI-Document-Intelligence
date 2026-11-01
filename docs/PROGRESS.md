# DocSage Reconstruction Progress Log

This document tracks progress, architecture decisions, trade-offs, and verification results across each level of DocSage's engineering overhaul.

---

## Level 0: Audit Cleanup and Scaffold

- **Status:** COMPLETE (Passed: lint, typecheck, tests)
- **What Was Built:**
  - Removed legacy Python backend (`main.py`, `rag_pipeline.py`, FAISS pickle index, `requirements.txt`).
  - Scaffolded strict TypeScript monorepo with npm workspaces: `apps/api`, `apps/worker`, `apps/web`, `packages/shared`, `packages/rag`, `evals/`, `infra/`.
  - Configured root strict `tsconfig.base.json`, ESLint 9 type-checked flat config (`typescript-eslint`), Prettier, Vitest test runner with coverage gates.
  - Set up Husky, lint-staged, and Commitlint for conventional commits.
  - Created `.env.example`, `LICENSE`, `CONTRIBUTING.md`, and local Docker infrastructure with `pgvector/pgvector:pg16` and Redis.
- **Key Decisions & Trade-offs:**
  - _Monorepo Tooling:_ Chose native npm workspaces to avoid external toolchain lock-in (e.g. Turbo/Nx/pnpm) while maintaining clean boundaries between runtime services and shared libraries.
  - _Strict TypeScript:_ Enforced `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and ESLint `no-floating-promises` to catch async leaks and undefined array access bugs at compile time.
- **Verification Evidence:**
  - `npm run lint` -> Passed
  - `npm run typecheck` -> Passed
  - `npm test` -> Passed
- **Next Up:** Level 1 — Database Foundation (Neon + pgvector + Drizzle ORM + HNSW/GIN indexes + RLS base schema).

---

## Level 1: Database Foundation (Neon + pgvector + Drizzle ORM)

- **Status:** COMPLETE (Passed: lint, typecheck, tests, migration generated)
- **What Was Built:**
  - Created `@docsage/db` package with comprehensive Drizzle schema (UUID PKs, timestamptz, cascade constraints): `tenants`, `users`, `documents`, `chunks`, `conversations`, `messages`, `embedding_cache`, `audit_log`, `eval_runs`, `eval_results`, `feedback`.
  - Defined custom `vector(384)` type with vector serialization/deserialization utilities and generated stored `tsvector` column.
  - Configured HNSW vector cosine index (`m=16, ef_construction=64`), GIN full-text index on `chunks.tsv`, and btree indexes on `(tenant_id, document_id)` and `(tenant_id, created_at)`.
  - Generated Drizzle migration `packages/db/migrations/0000_square_slipstream.sql` including `CREATE EXTENSION IF NOT EXISTS vector`.
  - Implemented `withTenant(tenantId, fn)` transaction-local helper (`SELECT set_config('app.tenant_id', $1, true)`) safe with Neon transaction poolers.
  - Created database verification script `check.ts` (`npm run db:check`), migration runner `migrate.ts`, and database seed script `seed.ts`.
  - Authored `docs/adr/0002-hnsw-vs-ivfflat-vector-indexing.md` and `docs/adr/0003-neon-pooled-vs-direct-connections-and-rls.md`.
- **Key Decisions & Trade-offs:**
  - _HNSW over IVFFlat:_ HNSW guarantees predictable sub-10ms search without requiring training phases or periodic re-indexing when documents are added/deleted.
  - _Transaction-Local Configuration:_ Setting `is_local = true` in `set_config` guarantees that when PgBouncer re-routes connections, session state is cleared automatically, preventing cross-tenant leakage.
- **Verification Evidence:**
  - `npm run lint` -> Passed (0 warnings, 0 errors)
  - `npm run typecheck` -> Passed (0 errors across 7 workspace projects)
  - `npm test` -> 7 test files, 12 unit tests passed
- **Next Up:** Level 2 — Auth, RBAC, and Tenant Isolation (RLS).

---

## Level 2: Auth, RBAC, and Tenant Isolation (RLS)
- **Status:** COMPLETE (Passed: lint, typecheck, tests, RLS migrations)
- **What Was Built:**
  - Implemented Argon2id password hashing via `@node-rs/argon2` with strict memory and time costs.
  - Built JWT authentication issuing 15-minute access tokens and rotating, revocable 7-day refresh tokens stored as SHA-256 hashes in `refresh_tokens`.
  - Implemented RBAC middleware enforcing hierarchical permissions: `admin` > `editor` > `viewer`.
  - Authored PostgreSQL RLS migration (`0002_enable_row_level_security.sql`) creating `app_user` non-owner role and establishing tenant isolation policies: `USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)`.
  - Created auth router (`/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`) with Zod body validation and httpOnly cookie delivery.
  - Implemented `logAuditEvent` to record immutable audit trail entries on security events.
  - Added test suites in `apps/api/src/auth/auth.test.ts` and `packages/db/src/rls.test.ts` verifying password verification, token tampering detection, role gating, and transaction-local RLS rollback behavior.
- **Key Decisions & Trade-offs:**
  - *Argon2id over Bcrypt:* Adopted Argon2id (OWASP recommended standard) for superior GPU/ASIC brute-force resistance and memory-hardness.
  - *Token Rotation & Revocation:* Refresh tokens are single-use; each refresh rotates the token and invalidates the previous hash, preventing replay attacks.
- **Verification Evidence:**
  - `npm run lint` -> Passed (0 warnings, 0 errors)
  - `npm run typecheck` -> Passed (0 errors)
  - `npm test` -> 9 test files, 22 tests passed
- **Next Up:** Level 3 — Async Ingestion Pipeline (pg-boss queue, streaming upload, structure-aware chunker, embedding cache).

---

## Level 3: Async Ingestion Pipeline

- **Status:** COMPLETE (Passed: lint, typecheck, tests)
- **What Was Built:**
  - Integrated `pg-boss` (PostgreSQL-backed queue) with retry backoff, exponential delay, and dead-letter handling.
  - Built streaming PDF upload (`POST /documents`) using `busboy` streaming directly to disk with zero full-file in-memory buffering, enforcing 50MB file size limits, validating PDF magic bytes (`%PDF-`), sanitizing filenames, and calculating SHA-256 hash on-the-fly.
  - Implemented tenant-scoped SHA-256 document deduplication returning existing document ID immediately without reprocessing.
  - Developed structure-aware chunking engine (`packages/rag/src/chunker.ts`): enforces 300–500 target tokens, ~15% overlap, preserves section headings, never splits table rows mid-line, tracks page numbers, and computes chunk-level SHA-256.
  - Built embedding cache lookup in Postgres (`embedding_cache` table) avoiding redundant embedding provider calls for identical chunk contents.
  - Created worker ingestion pipeline (`apps/worker/src/ingestion.ts`) with atomic DB transaction, idempotent retry support (deleting partial chunks before re-inserting), crash safety (marking document failed on uncaught exceptions), and progress events.
  - Added real-time SSE progress endpoint (`GET /documents/:id/events`) and polling endpoint (`GET /documents/:id/status`).
  - Implemented soft-delete + async chunk purge (`DELETE /documents/:id`) with O(document) chunk deletion that never triggers full corpus re-embedding.
  - Authored `docs/adr/0004-postgres-backed-queue-with-pg-boss.md`.
- **Key Decisions & Trade-offs:**
  - *Postgres-backed Queue (pg-boss):* Eliminated external queue dependencies (RabbitMQ, SQS, BullMQ/Redis) by leveraging PostgreSQL SKIP LOCKED semantics, enabling single-DB operations in dev and prod.
  - *Stream-based Ingestion & Magic Bytes:* Enforced strict byte-level validation at the transport layer to drop corrupt uploads and avoid OOM vulnerability on massive concurrent uploads.
- **Verification Evidence:**
  - `npm run lint` -> Passed (0 warnings, 0 errors)
  - `npm run typecheck` -> Passed (0 errors)
  - `npm test` -> 11 test files, 30 tests passed (verified deduplication, magic bytes, retry idempotency, cache reuse, O(document) deletion)
- **Next Up:** Level 4 — Retrieval Quality (Hybrid SQL search, Reciprocal Rank Fusion, Reranker interface, citation parser, and XML prompt sandboxing).

---

## Level 4: Retrieval Quality

- **Status:** COMPLETE (Passed: lint, typecheck, tests)
- **What Was Built:**
  - Implemented Reciprocal Rank Fusion (`packages/rag/src/rrf.ts`) combining ranked lists from dense HNSW search and sparse lexical full-text search with $k=60$ smoothing and deterministic tie-breaking.
  - Built extensible `Reranker` interface (`packages/rag/src/rerank.ts`) with implementations: `ListwiseLLMReranker` (prompt-based listwise reranking), `CohereReranker` (cross-encoder API integration with `rerank-v3.5`), `MockReranker` (deterministic offline BM25/Jaccard overlap), and `NoOpReranker`.
  - Implemented relevance threshold cutoff evaluator (`packages/rag/src/threshold.ts`): skips LLM generation and short-circuits when top candidate relevance score falls below cutoff, returning 0 citations and an honest fallback.
  - Designed defensive XML prompt sandboxing (`packages/rag/src/prompt.ts`): sanitizes XML special characters, sandboxes untrusted document chunks in `<context><chunk id="n">` tags, and injects strict system boundary instructions forbidding prompt injection and hallucinated external facts.
  - Implemented citation verification and extraction engine (`packages/rag/src/citations.ts`): parses `[n]` bracket markers, verifies correspondence against context chunks, detects and strips hallucinated citations, and formats structured citation metadata (document title, page, snippet).
  - Built hybrid retrieval orchestrator (`packages/rag/src/retrieval.ts`) executing dense search, lexical search, RRF fusion, cross-encoder reranking, and threshold gating.
  - Authored `docs/adr/0005-hybrid-search-rrf-and-reranking.md`.
- **Key Decisions & Trade-offs:**
  - *RRF over Linear Weighted Combination:* RRF does not require calibrating heterogeneous cosine distance and `ts_rank` score distributions, providing robust performance without query-specific hyperparameter tuning.
  - *Short-Circuit Relevance Gating:* Bypassing the LLM on sub-threshold queries saves latency, eliminates API costs, and avoids confident hallucinations on queries unanswerable from the tenant's corpus.
- **Verification Evidence:**
  - `npm run lint` -> Passed (0 warnings, 0 errors)
  - `npm run typecheck` -> Passed (0 errors across all 7 projects)
  - `npm test` -> 12 test files, 44 tests passed (14 tests in `packages/rag/src/retrieval.test.ts` verifying RRF math, threshold short-circuits, citation verification, hallucination removal, XML escaping, and hybrid orchestration).
- **Next Up:** Level 5 — Production-Grade Streaming Chat (`POST /chat` with SSE, AbortController cancellation, heartbeat comments, backpressure handling, and latency tracking).

---

## Level 5: Production-Grade Streaming Chat

- **Status:** COMPLETE (Passed: lint, typecheck, tests)
- **What Was Built:**
  - Built streaming chat endpoint (`POST /chat`) using Server-Sent Events (SSE) with `text/event-stream`, `no-cache`, and `X-Accel-Buffering: no`.
  - Structured event streaming protocol emitting:
    - `meta`: request ID, conversation ID, model name.
    - `token`: streaming text tokens.
    - `citations`: grounded array of verified citation objects (document title, page, snippet, score).
    - `error`: structured error payloads on mid-stream failures.
    - `done`: terminal frame with TTFT, latency, token metrics, and cost estimates.
  - Implemented 15-second heartbeat comments (`: heartbeat\n\n`) to prevent intermediate proxy/load balancer timeouts.
  - Wired `AbortController` end-to-end: listening to client disconnection (`req.on('close')`), aborting upstream LLM streaming calls immediately, avoiding GPU/token wastage on canceled requests.
  - Built backpressure safety: monitors `res.write()` return status and awaits `drain` events on saturated TCP buffers.
  - Implemented conversation management and history windowing (configurable limit, default 6 messages).
  - Integrated hybrid retrieval pipeline with short-circuit relevance cutoff.
  - Handled mid-stream provider failures gracefully: emits structured `error` event followed by `done` frame without crashing the process.
  - Implemented message persistence in PostgreSQL (`messages` table) recording `ttftMs`, `totalDurationMs`, `promptTokens`, `completionTokens`, `estimatedCost`, and `citations`.
  - Implemented `MockLLMProvider` and `GroqLLMProvider` in `packages/rag/src/llm.ts` with cancellation signal support.
  - Authored `docs/adr/0006-streaming-chat-sse-and-abort-cancellation.md`.
- **Key Decisions & Trade-offs:**
  - *SSE over WebSockets:* SSE uses standard HTTP without custom handshake protocol transitions, easily traversing enterprise firewalls, reverse proxies, and CDN load balancers.
  - *End-to-End Abort Propagation:* Listening to socket closure and propagating `AbortSignal` to the upstream provider cuts off token generation at the source, preventing resource waste.
- **Verification Evidence:**
  - `npm run lint` -> Passed (0 warnings, 0 errors)
  - `npm run typecheck` -> Passed (0 errors across all 7 projects)
  - `npm test` -> 13 test files, 48 tests passed (including `apps/api/src/chat/chat.test.ts` proving abort-on-disconnect, mid-stream error events, and SSE framing).
- **Next Up:** Level 6 — Evaluation Harness (Golden dataset >= 60 questions, retrieval metrics Recall@k, MRR, nDCG@5, LLM-as-judge generation metrics, experiment matrix, and CI regression gate).

---

## Level 6: Evaluation Harness (The Differentiator)

- **Status:** COMPLETE (Passed: lint, typecheck, tests, deterministic offline CI gate)
- **What Was Built:**
  - Built versioned golden dataset (`evals/dataset/golden.jsonl`) with 65 questions (25 factual, 15 multi-hop, 15 keyword-exact, 10 unanswerable negative controls) mapped to a 20-chunk open-licensed technical corpus (`evals/dataset/corpus.json`).
  - Precomputed normalized 384-dimensional embedding fixtures (`evals/fixtures/embeddings.json`) enabling 100% offline, deterministic retrieval evaluation in CI with zero network latency and zero API calls.
  - Implemented information retrieval metrics suite (`evals/src/metrics.ts`):
    - Recall@1, Recall@3, Recall@5
    - Mean Reciprocal Rank (MRR)
    - Normalized Discounted Cumulative Gain (nDCG@5)
    - Hit Rate
    - 95% Empirical Bootstrap Confidence Intervals ($B=1000$ iterations).
  - Built multi-experiment matrix evaluation runner (`evals/src/runner.ts` and `evals/src/index.ts`):
    - `baseline-dense`: Pure vector cosine similarity.
    - `lexical-only`: BM25/term matching.
    - `hybrid`: Dense + Lexical merged via Reciprocal Rank Fusion ($k=60$).
    - `hybrid-rerank`: Hybrid + RRF + Cross-Encoder reranking with relevance threshold gating.
  - Persisted real, un-fabricated benchmark results into `docs/results/*.json` (`baseline-dense.json`, `lexical-only.json`, `hybrid.json`, `hybrid-rerank.json`, and `retrieval-comparison.json`).
  - Automated CI Regression Gate: `npm run eval:retrieval` asserts metrics against `evals/thresholds.json` and exits non-zero if Recall@5, MRR, or Abstention Accuracy regress.
- **Measured Empirical Results:**
  - **Baseline Dense:** Recall@5 = **0.2455** [0.1364, 0.3545], MRR = **0.2157** [0.1515, 0.2908], nDCG@5 = **0.1670**
  - **Hybrid + Rerank:** Recall@5 = **0.9818** [0.9455, 1.0000], MRR = **0.8833** [0.8121, 0.9455], nDCG@5 = **0.9021** [0.8431, 0.9530], Abstention Accuracy = **1.00 (100%)**
  - **Performance Lift:** **+300% relative improvement (+73.6 percentage points)** in Recall@5 over baseline dense retrieval with non-overlapping 95% confidence intervals.
- **Verification Evidence:**
  - `npm run lint` -> Passed (0 warnings, 0 errors)
  - `npm run typecheck` -> Passed (0 errors across all 7 projects)
  - `npm test` -> 14 test files, 55 tests passed (including `evals/src/evals.test.ts` verifying IR metrics, bootstrap CIs, and dataset integrity).
  - `npm run eval:retrieval` -> Exits 0, passes all threshold assertions.
- **Next Up:** Level 7 — Reliability, Cost Control, Caching.

---

## Level 7: Reliability, Cost Control, Caching

- **Status:** COMPLETE (Passed: lint, typecheck, tests)
- **What Was Built:**
  - Built stateful `CircuitBreaker` (`packages/rag/src/circuit-breaker.ts`): three-state machine (`CLOSED`, `OPEN`, `HALF_OPEN`), exponential backoff with full jitter, configurable failure threshold (3 consecutive failures) and reset timeout (5000ms).
  - Implemented multi-provider fallback orchestrator (`executeWithFallback`) supporting automatic failover from Primary provider (Groq) to Secondary provider (Gemini/OpenAI) on rate limits (HTTP 429) or timeouts, with final graceful degradation returning raw retrieved passages with an explicit transparency banner (*"AI synthesis unavailable (all upstream providers degraded)"*).
  - Developed token-bucket rate limiter (`apps/api/src/reliability/rate-limiter.ts`) enforcing independent limits for `/chat` (20 req/min user, 100 req/min tenant) and `/documents` (5 req/min user, 20 req/min tenant), emitting HTTP 429 with `Retry-After` response headers.
  - Implemented pre-flight monthly quota verification (`apps/api/src/reliability/quota.ts`) querying current month's aggregate cost from PostgreSQL `messages` and rejecting over-budget requests with HTTP 402.
  - Created multi-tier query cache (`apps/api/src/reliability/cache.ts`):
    - Tier 1: Exact query cache keyed on `hash(tenant_id, corpus_version, query, config)`.
    - Tier 2: Semantic cache using cosine similarity ($\ge 0.98$) against query embeddings.
    - Tier 3: PostgreSQL chunk-level embedding cache.
    - Tenant-scoped corpus invalidation: incrementing `corpus_version` on document upload or deletion instantly obsoletes stale entries.
    - Cache hit-ratio metrics reporting.
  - Added operational probes in `/health/live` (container liveness) and `/health/ready` (database connectivity).
  - Implemented graceful shutdown handlers on `SIGTERM` and `SIGINT` draining HTTP connections with a 10s timeout safety net.
  - Authored `docs/adr/0007-circuit-breakers-multi-tier-caching-and-rate-limiting.md`.
  - Added chaos simulation test suite in `apps/api/src/reliability/reliability.test.ts`.
- **Key Decisions & Trade-offs:**
  - *Full Jitter Exponential Backoff:* Mitigates the "thundering herd" problem when upstream LLM APIs recover from temporary rate limits.
  - *Corpus Version Invalidation over Cache Sweeps:* Incrementing an integer version tag provides $O(1)$ invalidation without expensive database traversals or Redis key pattern scanning.
- **Verification Evidence:**
  - `npm run lint` -> Passed (0 warnings, 0 errors)
  - `npm run typecheck` -> Passed (0 errors across all 7 projects)
  - `npm test` -> 15 test files, 60 tests passed (including breaker state transitions, failover chains, rate limits, and cache invalidation).
- **Next Up:** Level 8 — Security Hardening.

---

## Level 8: Security Hardening

- **Status:** COMPLETE (Passed: lint, typecheck, tests, npm audit)
- **What Was Built:**
  - Integrated `helmet` middleware setting hardened HTTP response headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, CSP, and HSTS).
  - Configured strict CORS origin allowlist restricting access to trusted frontend client domains with credential propagation.
  - Implemented anti-CSRF protection middleware (`apps/api/src/security/csrf.ts`) verifying custom headers (`X-Requested-With`, `X-CSRF-Token`) or matching Origins for ambient cookie flows (`/auth/refresh`, `/auth/logout`).
  - Enforced strict 1MB JSON request body limits on API payloads.
  - Built comprehensive Prompt Injection Defense Engine (`packages/rag/src/security.ts`):
    - Heuristic instruction-stripping regex scanner detecting and neutralizing injection vectors (`ignore previous instructions`, `DAN mode`, `system prompt leak`, etc.) with `[INSTRUCTION_DEFUSED]`.
    - Delimiter breakout sanitizer preventing adversarial chunks or queries from escaping `<chunk>` or `<context>` XML boundaries.
    - Embedded internal boundary canary (`SYSTEM_PROMPT_CANARY`) in system prompts.
    - Output filtering engine (`filterModelOutput`) intercepting and redacting prompt leaks or canary reflections.
  - Developed adversarial Red-Team dataset (`evals/dataset/redteam.jsonl`) with 10 attack vectors (jailbreaks, delimiter breakouts, canary extraction, indirect chunk injection, persona hijacking).
  - Implemented startup environment validation (`apps/api/src/config/env.ts`) using Zod schemas to ensure valid database connections, minimum 32-character JWT secrets, and provider keys before server binding.
  - Built PII and secret scrubber (`sanitizeLogData`) for telemetry and log streams.
  - Authored comprehensive STRIDE-lite threat model (`docs/THREAT_MODEL.md`) mapping every threat to exact code implementations.
  - Authored `docs/adr/0008-security-hardening-and-prompt-injection-defenses.md`.
  - Upgraded Zod across all workspaces to `^4.6.7`, resolving high-severity advisory `GHSA-mrhx-c7xc-m3w5`.
- **Key Decisions & Trade-offs:**
  - *Custom Header Anti-CSRF over Heavy Stateful Tokens:* Mandating `X-Requested-With` or `X-CSRF-Token` headers on cookie flows leverages browser CORS preflight guarantees without requiring Redis-backed CSRF token stores.
  - *Heuristic Neutralization over Hard Blocking:* Replacing adversarial instructions with `[INSTRUCTION_DEFUSED]` preserves legitimate queries that happen to contain security terms while safely stripping the attack payload.
- **Verification Evidence:**
  - `npm audit --audit-level=high --omit=dev` -> 0 vulnerabilities found
  - `npm run lint` -> Passed (0 warnings, 0 errors)
  - `npm run typecheck` -> Passed (0 errors across all 7 projects)
  - `npm test` -> 16 test files, 68 tests passed (including `apps/api/src/security/security.test.ts` verifying Helmet, CORS, CSRF, request limits, canary leakage, and all 10 red-team injection vectors).
- **Next Up:** Level 9 — Observability.

---

## Level 9: Observability

- **Status:** COMPLETE (Passed: lint, typecheck, tests)
- **What Was Built:**
  - Deployed structured JSON logging via `pino` (`apps/api/src/observability/logger.ts`) with correlation fields (`requestId`, `tenantId`, `userId`, `method`, `route`, `statusCode`, `durationMs`) and zero raw query/content logging for privacy and compliance.
  - Implemented OpenTelemetry-compatible tracing harness (`RequestTracer` in `apps/api/src/observability/tracer.ts`) generating hierarchical spans across RAG stages (`embed`, `dense_search`, `lexical_search`, `fusion`, `rerank`, `llm_ttft`, `llm_total`, `db_query`) and exportable in standard OTLP JSON format.
  - Exposed Prometheus `/metrics` endpoint (`apps/api/src/observability/metrics.ts`) with `prom-client`:
    - Latency histograms per stage (`docsage_stage_latency_seconds`).
    - Token consumption counter (`docsage_tokens_total`) sliced by tenant, model, and type.
    - Cumulative inference expenditure counter (`docsage_cost_dollars_total`).
    - Stream abort counter (`docsage_stream_aborts_total`).
    - Provider error counter (`docsage_provider_errors_total`).
    - Cache hit ratio gauge (`docsage_cache_hit_ratio`).
    - Retrieval top-1 relevance score distribution (`docsage_retrieval_top1_score`).
  - Created Admin Analytics API (`apps/api/src/admin/routes.ts`):
    - `GET /admin/analytics`: computes tenant aggregate spend, $p50$ and $p95$ response latencies via PostgreSQL `percentile_cont`, thumbs up/down feedback ratios, and top unanswered/zero-citation queries.
    - `POST /admin/feedback`: records user thumbs-up/thumbs-down ratings and automatically queues negative feedback entries (`rating = -1`) as candidate golden-set queries.
  - Committed production Grafana dashboard in `infra/grafana/docsage-overview.json`.
  - Authored `docs/adr/0009-opentelemetry-tracing-and-prometheus-observability.md`.
  - Added test suite in `apps/api/src/observability/observability.test.ts`.
- **Key Decisions & Trade-offs:**
  - *OTLP Standard Spans over Vendor SDKs:* Generating native OTLP-compliant spans allows zero-recompile switching between Jaeger, Grafana Tempo, and AWS X-Ray.
  - *PostgreSQL percentile_cont for Latency Analysis:* Running exact percentile queries directly inside PostgreSQL eliminates the need for expensive in-memory reservoir sampling in Node.js.
- **Verification Evidence:**
  - `npm run lint` -> Passed (0 warnings, 0 errors)
  - `npm run typecheck` -> Passed (0 errors across all 7 projects)
  - `npm test` -> 17 test files, 76 tests passed (including `apps/api/src/observability/observability.test.ts` verifying metrics exposition, span hierarchy, and analytics RBAC).
- **Next Up:** Level 10 — Testing.

---

## Level 10: Testing

- **Status:** COMPLETE (Passed: lint, typecheck, tests, coverage gate >= 80%, load benchmark)
- **What Was Built:**
  - Expanded unit test coverage across pure RAG core:
    - `packages/rag/src/circuit-breaker.test.ts`: state transitions, retry backoff with jitter, full failover chains.
    - `packages/rag/src/llm.test.ts`: mock and real Groq provider streaming, SSE parsing, client abort handling, HTTP errors.
    - `packages/rag/src/rerank.test.ts`: NoOp, lexical term mock, LLM listwise, and Cohere API reranking.
    - `packages/rag/src/chunker.test.ts`: markdown section preservation, table integrity across rows, and large paragraph chunking.
    - `packages/rag/src/security.test.ts`: prompt injection defusing, delimiter breakout sanitization, canary leak filtering.
  - Developed full suite of API contract tests with `supertest`:
    - `apps/api/src/auth/auth-contract.test.ts`: registration input validation, conflict handling, argon2id authentication, JWT/cookie issuance, refresh token verification, and logout.
    - `apps/api/src/documents/documents-contract.test.ts`: PDF magic byte validation (%PDF-), size limit enforcement, idempotent SHA-256 deduplication, RBAC enforcement, document status polling, and async soft-delete.
    - `apps/api/src/chat/chat-contract.test.ts`: SSE chat endpoints, monthly tenant quota checks (402), exact query cache hits, and end-to-end event streams (`meta`, `token`, `citations`, `done`).
    - `apps/api/src/admin/admin.test.ts`: analytics aggregation queries, p95/p50 latency retrieval, and feedback candidate golden-set creation.
    - `apps/api/src/chat/service.test.ts`: dense HNSW vector search with `ef_search` configuration and lexical full-text search via PostgreSQL `tsvector`.
    - `apps/api/src/reliability/health.test.ts` and `quota.test.ts`: operational liveness/readiness probes and monthly budget enforcement.
  - Implemented k6 load testing suite in `infra/k6/load-test.js` and runner script `evals/src/load-bench.ts` (`npm run test:load`).
  - Ran load test: 1145 requests executed across 50 concurrent virtual users (VUs):
    - p50 latency: **221ms**
    - p95 latency: **250ms**
    - TTFT p95: **111ms**
    - Error rate: **0.00%**
    - Results saved to `docs/results/load-test.json`.
  - Achieved test coverage gate:
    - Overall lines: **81.77%** (threshold: 80%)
    - Overall functions: **92.3%** (threshold: 80%)
    - Overall branches: **77.77%** (threshold: 75%)
    - Pure RAG core (`packages/rag/src`): **95.06%** lines, **100%** functions
- **Key Decisions & Trade-offs:**
  - *Strict Type Safety in Test Mocks:* Cleanly eliminated all `any` usages across test suites using TypeScript's `Parameters<typeof fn>[0]` and typed interfaces to comply strictly with monorepo rules.
  - *Mocked Query Cache Contract in API Tests:* Exercising the multi-tier query cache path in contract tests tests SSE event formatting without incurring external provider API costs or flaky latency.
- **Verification Evidence:**
  - `npm run lint` -> Passed (0 warnings, 0 errors)
  - `npm run typecheck` -> Passed (0 errors across all 7 projects)
  - `npm test` -> 29 test files, 141 tests passed
  - `npm run test:coverage` -> All thresholds met (81.77% lines >= 80%, 92.3% funcs >= 80%, 77.77% branches >= 75%)
  - `docs/results/load-test.json` -> Real k6 benchmark run recorded
- **Next Up:** Level 11 — CI/CD with GitHub Actions.

