# ADR 0004: Postgres-Backed Job Queue Architecture with pg-boss

## Context
Document ingestion in RAG involves long-running operations:
1. Streaming file persistence to storage.
2. PDF text and structural layout extraction.
3. Sentence-level structure-aware chunking.
4. High-dimensional vector embedding generation via external API or local ONNX runtime.

Executing these steps synchronously within the HTTP request lifecycle blocks web worker threads, risks proxy timeouts (e.g., AWS ALB 30s timeout), and causes process memory exhaustion under concurrent uploads. An asynchronous job queue is mandatory.

## Options Considered

### Option 1: Redis + BullMQ
- *Pros:* High throughput (in-memory Redis); mature ecosystem for Node.js.
- *Cons:* Requires running and maintaining a separate Redis cluster/instance for reliable queue state; cannot participate in PostgreSQL ACID transactions (e.g. enqueuing a job atomically when inserting a document record). If the Redis queue is unavailable or crashes before persistence, jobs are lost.

### Option 2: External Message Brokers (RabbitMQ / Apache Kafka / AWS SQS)
- *Pros:* High distributed scale; event streaming.
- *Cons:* Extreme operational complexity for document ingestion workloads; requires dedicated infra, schemas, and credentials; overkill for $10^2 - 10^5$ daily document operations.

### Option 3: PostgreSQL-Backed Queue via `pg-boss`
- *Mechanism:* Implements job scheduling, retries with exponential backoff, priority queues, and dead-letter queues directly on PostgreSQL using `SKIP LOCKED` row-level locking.
- *Trade-offs:*
  - *Pros:* Zero additional infrastructure required (PostgreSQL on Neon is already our source of truth); **Transactional Enqueuing**—jobs can be enqueued inside the same database transaction that creates the document record, guaranteeing zero orphan documents; automatic retries and dead-letter queues (DLQ); natively handles worker crashes safely.
  - *Cons:* Database throughput overhead if polling frequency is too aggressive (mitigated by Neon connection pooling and pg-boss's adaptive backoff).

## Decision
Adopt **`pg-boss`** as the core job queue engine:
- Queue names:
  - `document-ingestion`: Handles parsing, structure-aware chunking, embedding, and chunk upsertion.
  - `document-purge`: Handles asynchronous cleanup of chunk embeddings upon document deletion.
- Retry policy: `retryLimit: 3`, `retryBackoff: true`, `retryDelay: 5`.
- Dead-letter queue enabled for unrecoverable parsing errors.

## Consequences & Trade-offs
- **Positive:** Atomic document creation and job enqueuing; zero external infrastructure dependencies; transparent operational visibility via standard SQL queries.
- **Negative:** Storage for job archives and audit logs lives in Postgres; old completed jobs must be pruned by pg-boss's built-in retention cleaner.
