# DocSage System Architecture & Code Organization

This document outlines the architectural boundaries, feature-first modular decomposition, package dependency graph, and automated code quality limits enforced across the DocSage PERN + TypeScript monorepo.

---

## 1. Architectural Principles

1. **Strict Feature-First Encapsulation:** Business domain logic is grouped by feature rather than generic technical roles.
2. **Defensive Multi-Tenancy:** Row-Level Security (RLS) policies filter every SQL query at the database engine level via `current_setting('app.tenant_id', true)`. Connections operate under a non-BYPASSRLS role (`app_user`).
3. **Fail-Fast Boundary Validation:** All network boundaries, environment secrets, and inter-package payloads are validated strictly with Zod schemas.
4. **Deterministic Observability:** Every retrieval query, LLM token stream, and background worker job emits structured OpenTelemetry spans and Prometheus metrics.
5. **No Blind Vendor Lock-In:** Core interfaces (`LLMProvider`, `EmbeddingProvider`, `Reranker`) abstract upstream foundation model APIs, with native Gemini 1.5 Flash fallback and zero legacy external dependencies.

---

## 2. Monorepo Package Topology & Layout

```
docsage-monorepo/
├── apps/
│   ├── api/                  # Express 5 REST & SSE Streaming Server
│   │   └── src/
│   │       ├── admin/        # Admin telemetry, analytics & golden dataset review
│   │       ├── audit/        # Tamper-proof append-only audit trail logger
│   │       ├── auth/         # Argon2id, JWT access & rotating refresh cookies
│   │       ├── chat/         # SSE streaming chat pipeline, cancellation, semantic cache
│   │       ├── config/       # Strict 8-variable fail-fast environment schema
│   │       ├── documents/    # Busboy multipart streaming upload, SHA-256 deduplication
│   │       ├── observability/# Prometheus metrics & OpenTelemetry trace collectors
│   │       ├── reliability/  # In-memory LRU/semantic cache & token-bucket rate limiter
│   │       └── security/     # CSRF Double-Submit cookies & security headers
│   ├── web/                  # React 18 + Vite Frontend Application
│   │   └── src/
│   │       ├── api/          # Typed API client and SSE stream reader
│   │       ├── components/   # Modular UI primitives (KPICard, UploadDropzone, ChatMessageItem, CitationDrawer)
│   │       ├── context/      # AuthContext and tenant state management
│   │       └── pages/        # AdminPage, AuthPage, ChatPage, DocumentsPage
│   └── worker/               # Background Ingestion & Purge Worker (pg-boss)
│       └── src/
│           ├── embedding.ts  # Worker-tier Gemini embedding generator
│           ├── ingestion.ts  # PDF text extraction, recursive chunking, pgvector inserts
│           └── queue.ts      # pg-boss worker job registration and concurrency
├── packages/
│   ├── db/                   # Database Client & Migration Layer
│   │   ├── migrations/       # Drizzle SQL schema migrations
│   │   └── src/
│   │       ├── schema/       # Multi-tenant tables (tenants, documents, chunks, conversations, messages, audit_log, feedback)
│   │       ├── check.ts      # Schema, RLS, and NOBYPASSRLS permission integrity audit
│   │       ├── client.ts     # Pooled (PgBouncer) & direct connection pools with withTenant
│   │       ├── migrate.ts    # Drizzle automated migrator
│   │       └── reembed.ts    # Batch backfill worker for vector dimension migration
│   ├── rag/                  # RAG Algorithms & Foundation Provider Integrations
│   │   └── src/
│   │       ├── chunker.ts    # Recursive character text chunker with sentence boundary protection
│   │       ├── citations.ts  # Grounded citation verification and snippet validation
│   │       ├── llm/          # Modular LLM providers (Groq, Gemini, Mock, SSE stream consumer)
│   │       ├── models.ts     # Centralized model registry and hyperparameter configurations
│   │       ├── prompt.ts     # Grounded system prompts with XML sandboxed context
│   │       ├── rerank.ts     # GeminiListwiseReranker & Fallback Reciprocal Rank Reranker
│   │       ├── retrieval.ts  # Hybrid retrieval orchestrator (Dense + Lexical + RRF)
│   │       ├── rrf.ts        # Reciprocal Rank Fusion (RRF k=60) formulation
│   │       ├── security.ts   # Prompt injection defense, canary tokens, and output filtering
│   │       └── threshold.ts  # Offline tuned relevance cutoff short-circuit guard
│   └── shared/               # Shared Zod Schemas & TypeScript Contract Definitions
│       └── src/
│           └── index.ts      # MinimalEnvSchema, Chat contracts, SSE event payloads
└── evals/                    # Golden Dataset Evaluation & CI Regression Harness
    ├── dataset/              # Modular golden questions (factual, complex, heldout) & corpus fixtures
    └── src/
        ├── metrics.ts        # Recall@k, MRR, nDCG@k, bootstrap confidence interval calculations
        ├── report.ts         # Metric compilation and production threshold gates
        └── runner.ts         # Offline deterministic evaluation runner across retrieval strategies
```

---

## 3. Automated Code Quality Gates & DoD Enforcement

To prevent technical debt, ensure FAANG-grade engineering standards, and maintain maintainability:

| Quality Dimension         | Standard / Limit                         | Tooling & Enforcement            | Current Monorepo Metric                  |
| :------------------------ | :--------------------------------------- | :------------------------------- | :--------------------------------------- |
| **Max File Length**       | `<= 300 lines` per file                  | ESLint `max-lines` rule          | **100% compliant** (0 files > 300 lines) |
| **Max Function Length**   | `<= 50 lines` per function               | ESLint `max-lines-per-function`  | Enforced                                 |
| **Cyclomatic Complexity** | `<= 10` per function                     | ESLint `complexity` rule         | Enforced                                 |
| **Code Duplication**      | `< 3.0%` across monorepo                 | `jscpd` static analysis          | **2.62%** (Passed)                       |
| **Unused Code / Exports** | `0` unused items                         | `knip` static dead-code analysis | **0 unused exports** (Passed)            |
| **Type Safety**           | TypeScript Strict Mode (`noImplicitAny`) | `tsc -b`                         | **0 type errors**                        |
| **Test Coverage**         | `>= 80%` branch & line coverage          | Vitest + v8 coverage             | **30 test files / 155 tests green**      |
| **Offline Eval Gate**     | Recall@5 >= 0.85, MRR >= 0.70            | Offline Evaluation Harness       | **Passed (Recall@5: 1.000, MRR: 0.968)** |

---

## 4. Key Architectural Boundaries & Data Flow

### 4.1 Document Ingestion Pipeline

```
[Client PDF Upload]
       │
       ▼ (multipart/form-data)
[apps/api: POST /documents]
       │ (Verify %PDF- magic bytes, SHA-256 deduplication check)
       ├─► [packages/db: documents table] (status: 'pending')
       └─► [pg-boss: document-ingestion queue]
                  │
                  ▼ (Worker consumes job)
       [apps/worker: IngestionWorker]
                  │ (pdf-parse text extraction)
                  ▼
       [packages/rag: RecursiveChunker] (500 tokens, 100 overlap)
                  │
                  ▼
       [packages/rag: GeminiEmbeddingProvider] (768-d text-embedding-004)
                  │
                  ▼
       [packages/db: withTenant transaction]
                  ├──► chunks table (embedding: vector(768), tsv: tsvector)
                  └──► documents table (status: 'ready')
```

### 4.2 Streaming RAG Pipeline

```
[User Question]
       │
       ▼
[apps/api: POST /chat]
       │
       ├─► Check Semantic Query Cache (Cosine threshold >= 0.95)
       │       └─► Cache Hit: Stream instantaneous cached answer + citations
       │
       ▼ Cache Miss:
[packages/rag: executeHybridRetrieval]
       ├──► Dense Branch: pgvector HNSW cosine search (<=>)
       ├──► Lexical Branch: PostgreSQL ts_rank against GIN index (@@)
       └──► Reciprocal Rank Fusion: RRF (k=60) score combination
                  │
                  ▼
[packages/rag: Relevance Cutoff Guard]
       ├── Score < 0.05: Short-circuit with "Information not found" (0 LLM cost)
       └── Score >= 0.05: Continue
                  │
                  ▼
[packages/rag: GeminiListwiseReranker] (Top-5 candidate reranking)
                  │
                  ▼
[packages/rag: buildRAGPrompt] (Sandboxed XML context, injection defense)
                  │
                  ▼
[Primary Provider: GroqLLMProvider (Llama-3.3-70b-versatile)]
       │ (Circuit Breaker / Fallback on failure)
       ▼
[Fallback Provider: GeminiLLMProvider (Gemini-1.5-flash)]
       │
       ▼ (Server-Sent Events: token chunks)
[packages/rag: verifyAndExtractCitations]
       │ (Strict regex & snippet verification against retrieved passages)
       ▼
[apps/api: recordAssistantMessage]
       ├── Persist assistant content with verified citation IDs
       ├── Populate Semantic Query Cache
       └── Record TTFT, latency, token count, and cost in Prometheus
```
