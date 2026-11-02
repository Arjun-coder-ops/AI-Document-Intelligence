# DocSage — Measured FAANG-Grade Resume Bullets

> **Strict Engineering Standard:** Every metric below is derived strictly from real, executed script and benchmark runs recorded in [`docs/results/`](file:///c:/Users/gogua/OneDrive/Desktop/rag-chatbot/docs/results/). Zero numbers are fabricated or estimated.

---

### Bullet 1: Hybrid Retrieval & Evaluation Harness (RAG Core)

- **Engineered a hybrid RAG retrieval engine** combining pgvector HNSW cosine search (top-25) and PostgreSQL full-text search (`ts_rank`, top-25) via Reciprocal Rank Fusion ($k=60$) and Cross-Encoder reranking, lifting **Recall@5 from 0.2455 to 0.9818 (+300%)**, **MRR from 0.2157 to 0.8833 (+309%)**, and **nDCG@5 from 0.1670 to 0.9021 (+440%)** over a 65-question golden benchmark (1,000 bootstrap resamples at 95% CI).

---

### Bullet 2: Concurrency Profiling & Performance Engineering

- **Stress-tested distributed streaming chat under 50 concurrent virtual users (k6)**, sustaining **218.59 req/sec at a 0.00% error rate** across 1,145 requests; profiled HNSW vector index graph traversals, tuning `hnsw.ef_search` from 100 to 40 to slash **p95 retrieval latency from 82ms to 18ms (-78%)** while maintaining a **p95 total end-to-end latency of 250ms** and **Time-to-First-Token (TTFT) p95 of 111ms**.

---

### Bullet 3: Multi-Tenant Database Kernel Isolation (RLS)

- **Architected kernel-level multi-tenant data isolation** on Neon PostgreSQL using Row-Level Security (RLS) policies scoped via transaction-local `set_config('app.tenant_id', $1, true)` under an unprivileged `NOBYPASSRLS` application role, mathematically preventing cross-tenant data leaks across vector, full-text, and direct ID lookups without application-layer `WHERE` clause reliance.

---

### Bullet 4: Resilient Streaming Infrastructure & Circuit Breaking

- **Implemented an end-to-end SSE streaming pipeline with real-time upstream cancellation** via `AbortController`, eliminating wasted GPU token spend on client disconnects; built an Opossum circuit breaker with full-jitter exponential backoff facilitating seamless automated failover from Groq (Llama 3.3 70B) to Gemini (1.5 Flash) and graceful fallback to raw retrieved passages.

---

### Bullet 5: Asynchronous Ingestion & CI/CD Regression Gating

- **Constructed an asynchronous, crash-safe ingestion pipeline** using `pg-boss` with SHA-256 deduplication and disk-streamed PDF magic byte validation, backed by an automated GitHub Actions CI pipeline enforcing an **81.77% code coverage gate (142 tests)** and deterministic offline retrieval regression checks that block PR merges if Recall@5 drops below 0.85 or MRR drops below 0.70.

---

### Additional Verified Metrics Summary Table

| Category                     | Metric                         | Measured Value                      | Verification Source               |
| :--------------------------- | :----------------------------- | :---------------------------------- | :-------------------------------- |
| **Retrieval Quality**        | Recall@5                       | **0.9818** [95% CI: 0.9455, 1.0000] | `docs/results/hybrid-rerank.json` |
| **Retrieval Quality**        | Mean Reciprocal Rank (MRR)     | **0.8833** [95% CI: 0.8121, 0.9455] | `docs/results/hybrid-rerank.json` |
| **Retrieval Quality**        | nDCG@5                         | **0.9021** [95% CI: 0.8431, 0.9530] | `docs/results/hybrid-rerank.json` |
| **Hallucination Prevention** | Abstention Accuracy            | **100.0% (10/10)**                  | `docs/results/hybrid-rerank.json` |
| **System Throughput**        | Requests / Second              | **218.59 req/sec**                  | `docs/results/load-test.json`     |
| **System Reliability**       | HTTP Error Rate at 50 VUs      | **0.00% (0 / 1,145)**               | `docs/results/load-test.json`     |
| **Streaming Latency**        | Time to First Token (TTFT p50) | **98 ms**                           | `docs/results/load-test.json`     |
| **Streaming Latency**        | Time to First Token (TTFT p95) | **111 ms**                          | `docs/results/load-test.json`     |
| **End-to-End Latency**       | p50 Total Latency              | **221 ms**                          | `docs/results/load-test.json`     |
| **End-to-End Latency**       | p95 Total Latency              | **250 ms**                          | `docs/results/load-test.json`     |
| **HNSW Optimization**        | Retrieval Stage Latency        | **18 ms (down from 82ms)**          | `docs/results/load-test.json`     |
| **Test Suite Health**        | Passing Tests                  | **142 tests (29 files)**            | `npm test`                        |
| **Code Coverage Gate**       | Overall Line Coverage          | **81.77% (Threshold: 80%)**         | `npm run test:coverage`           |
| **RAG Core Coverage**        | `packages/rag` Line Coverage   | **95.06% (Threshold: 80%)**         | `npm run test:coverage`           |
