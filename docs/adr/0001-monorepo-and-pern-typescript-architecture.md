# ADR 0001: Monorepo Structure and PERN TypeScript Architecture

## Context

DocSage was previously implemented as a Python/FastAPI prototype using local in-memory FAISS indices, raw pickle serialization, and zero database or test infrastructure. This architecture suffered from severe scaling, concurrency, and security bottlenecks:

1. In-process vector indices prevented multi-worker horizontal scaling.
2. Synchronous ingestion blocked HTTP requests.
3. Lack of strict types, tests, and schema migrations failed enterprise SDE standards.

We require a unified, enterprise-grade architecture that demonstrates distributed systems rigor, data integrity, and strict type safety.

## Options Considered

1. **Polyglot (Python FastAPI RAG Service + Node/Express Web Service):**
   - _Pros:_ Leverages Python ML ecosystem (LangChain, PyTorch).
   - _Cons:_ Duplicates domain types and validation schemas; increases CI/CD complexity and deployment operational overhead; introduces cross-language IPC latency.
2. **Full PERN Stack with TypeScript Monorepo (Express 5, Node 20+, Postgres + pgvector, React):**
   - _Pros:_ Single language (TypeScript strict mode) across client, API, queue workers, and RAG core. Shared Zod contracts between client and server. Direct SQL integration with `pgvector` for transactional data integrity and Row-Level Security (RLS). Express 5 provides native async error handling.
   - _Cons:_ Requires implementing pure, idiomatic TypeScript RAG primitives rather than relying on heavy Python library abstractions (which is an asset for demonstrating SDE depth).

## Decision

Adopt a **Full PERN Stack Monorepo** using npm workspaces:

- `apps/api`: Express 5 HTTP & SSE server with RLS tenant isolation.
- `apps/worker`: Background worker processing `pg-boss` ingestion jobs.
- `apps/web`: React 18, Vite, TypeScript, and TanStack Query.
- `packages/shared`: Shared Zod schemas, types, and contracts.
- `packages/rag`: Framework-agnostic RAG algorithms (hybrid retrieval, RRF, reranking, chunking, prompt engineering).
- `evals/`: Automated evaluation harness with statistical CI gates.

## Consequences & Trade-offs

- **Positive:** Compile-time type safety end-to-end; zero deserialization security risks; atomic transactions; horizontal worker scalability.
- **Negative:** Embeddings and vector math run in Node.js or via managed provider APIs; requires explicit database migration management (Drizzle ORM).
