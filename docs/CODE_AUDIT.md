# DocSage Code Quality & Architectural Audit

**Date:** 2026-11-02  
**Commit:** Phase 4 Baseline  
**Auditor:** Principal Software Engineer & Hiring Committee Reviewer

---

## 1. Executive Summary

This audit assesses the structural integrity, boundary compliance, duplication ratio, and modularity of the rebuilt DocSage PERN TypeScript codebase.

### Key Metrics Summary (Pre-Refactoring)

- **Total Source Files:** 75 TypeScript / TSX files
- **Files Exceeding 300 Lines:** 6 files (`apps/api/src/chat/routes.ts`, `apps/api/src/documents/routes.ts`, `packages/rag/src/llm.ts`, `evals/src/generate-dataset.ts`, `evals/src/runner.ts`, `packages/rag/src/retrieval.test.ts`)
- **Copy-Paste Duplication Rate (jscpd):** 3.91% (Goal: < 3.0%)
- **Primary Clones Identified:**
  - SSE streaming parsing loop duplicated across Groq and Gemini clients in `packages/rag/src/llm.ts` (29 duplicated lines).
  - Express stream response headers and error serialization in `apps/api/src/chat/routes.ts` and `apps/api/src/admin/routes.ts`.
  - Multipart upload parsing and stream piping in `apps/api/src/documents/routes.ts`.

---

## 2. File-by-File Boundary Violations (> 300 Lines)

| File Path                            | Current Lines | Primary Responsibility                                                     | Refactoring Action Plan                                                                                                                       |
| :----------------------------------- | :------------ | :------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/rag/src/llm.ts`            | 386 lines     | Groq, Gemini, Mock providers, SSE stream reader                            | Extract shared `parseSSEStream` helper; split into `llm/groq.ts`, `llm/gemini.ts`, `llm/mock.ts`, and `llm/index.ts`. All files <= 150 lines. |
| `apps/api/src/chat/routes.ts`        | 434 lines     | Router definition, SSE streaming loop, error handling, abort controller    | Extract SSE stream session coordinator into `chat/stream.ts`. Keep `routes.ts` solely as declarative endpoint routing (< 100 lines).          |
| `apps/api/src/documents/routes.ts`   | 419 lines     | File upload, magic byte check, ingestion enqueue, status check, deletion   | Extract disk streaming upload processor into `documents/upload.ts`. Split CRUD handlers into `documents/handlers.ts`.                         |
| `evals/src/generate-dataset.ts`      | 1010 lines    | Golden dataset questions, corpus text constants, SHA-256 embeddings        | Extract inline document corpus text into `evals/dataset/raw-texts.ts`.                                                                        |
| `evals/src/runner.ts`                | 310 lines     | Retrieval evaluation runner, metric calculations, markdown table formatter | Extract markdown table and bootstrap CI reporter into `evals/src/report.ts`.                                                                  |
| `packages/rag/src/retrieval.test.ts` | 304 lines     | Comprehensive dense, lexical, and hybrid search integration tests          | Split into unit tests for scoring and integration tests for query planning.                                                                   |

---

## 3. Function Complexity & Length Analysis (> 50 Lines / Cyclomatic > 10)

1. **`streamText` in `GroqLLMProvider` and `GeminiLLMProvider` (65 lines each):**
   - _Problem:_ Reads raw `ReadableStream`, decodes chunks, splits by newlines, parses SSE JSON packets, handles edge-case stream terminations.
   - _Resolution:_ Extract reusable `consumeSSEStream(stream, onToken, signal)` utility. Reduces provider methods to < 20 lines.
2. **`POST /chat` Route Handler in `apps/api/src/chat/routes.ts` (145 lines):**
   - _Problem:_ Performs rate-limit check, quota check, tenant RLS setup, hybrid retrieval, circuit-breaker failover execution, and SSE chunk pipeline in a single monolithic handler.
   - _Resolution:_ Decompose into pipeline steps: `prepareChatContext`, `streamChatSynthesis`, and `handleChatError`.
3. **`POST /documents` Upload Handler in `apps/api/src/documents/routes.ts` (110 lines):**
   - _Problem:_ Concurrently checks magic bytes, writes file to disk, computes SHA-256 hash, validates quota, creates database record, and dispatches `pg-boss` job.
   - _Resolution:_ Delegate file parsing to `streamUploadToDisk` utility returning `{ filePath, hash, sizeBytes }`.

---

## 4. Dead Code & Package Hygiene (Knip Analysis)

- **Unused Dependencies:** Evaluated with `knip`. All monorepo workspaces audited.
- **Transitive Leaks:** Re-exported types consolidated into `@docsage/shared` and `@docsage/rag`.
- **Environment Schema Consolidation:** All 8 production environment variables centralized in `MinimalEnvSchema` with runtime fallback in `apps/api/src/config/env.ts`.

---

## 5. Copy-Paste Detection (jscpd Target: < 3%)

- **Pre-Refactor Duplication:** 3.91% across 112 analyzed source files.
- **Root Cause of Clones:**
  - Duplicate SSE line-splitting loop in `packages/rag/src/llm.ts` (lines 160-189 vs 285-314).
  - Duplicate error response formatting in Express route handlers.
- **Post-Refactor Target:** < 2.5% duplication with zero functional regression across all 30 test suites.
