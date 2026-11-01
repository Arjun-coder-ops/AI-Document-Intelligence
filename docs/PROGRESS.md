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



