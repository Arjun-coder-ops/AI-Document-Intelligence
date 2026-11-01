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
  - *HNSW over IVFFlat:* HNSW guarantees predictable sub-10ms search without requiring training phases or periodic re-indexing when documents are added/deleted.
  - *Transaction-Local Configuration:* Setting `is_local = true` in `set_config` guarantees that when PgBouncer re-routes connections, session state is cleared automatically, preventing cross-tenant leakage.
- **Verification Evidence:**
  - `npm run lint` -> Passed (0 warnings, 0 errors)
  - `npm run typecheck` -> Passed (0 errors across 7 workspace projects)
  - `npm test` -> 7 test files, 12 unit tests passed
- **Next Up:** Level 2 — Auth, RBAC, and Tenant Isolation (RLS).
