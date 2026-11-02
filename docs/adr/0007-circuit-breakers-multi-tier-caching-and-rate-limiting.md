# ADR 0007: Circuit Breakers, Multi-Provider Fallbacks, and Multi-Tier Caching

## Status

Accepted

## Context

High-reliability RAG applications depend on external LLM and embedding APIs (Groq, OpenAI, Gemini, Cohere) that are subject to rate limiting (HTTP 429), intermittent outages (503/504), and variable latency spikes. Furthermore, uncontrolled user queries can rapidly exhaust tenant token budgets and compromise multi-tenant system stability.

Key production requirements:

1. **Upstream Fault Tolerance:** When an LLM provider encounters rate limits or service degradation, the system must not crash or leave user streams hanging.
2. **Cost Control & Quota Management:** Per-user and per-tenant burst protection prevents noisy neighbors from exhausting API rate limits. Monthly token/cost budgets must be checked pre-flight.
3. **Multi-Tier Caching:** Redundant queries must not repeatedly invoke expensive embedding models and LLMs. Document mutations must instantaneously invalidate query caches without corpus-wide recomputation.
4. **Graceful Degradation:** When all upstream AI synthesis providers fail, users must still receive retrieved document passages with explicit transparency rather than an opaque 500 error.

## Decision

1. **Stateful Circuit Breaker with Exponential Backoff:**
   - Implemented a three-state machine (`CLOSED`, `OPEN`, `HALF_OPEN`) per provider.
   - Trips from `CLOSED` to `OPEN` after 3 consecutive failures, fast-failing subsequent requests for 5,000ms before probing in `HALF_OPEN`.
   - Employs exponential backoff with full randomized jitter: $t_{delay} = \text{random}(0, \min(t_{max}, t_{base} \cdot 2^{attempt}))$.

2. **Hierarchical Multi-Provider Fallback Chain:**
   - Primary Provider: Groq (ultra-low latency LLaMA 3.3).
   - Secondary Provider: Gemini / OpenAI (high availability fallback).
   - Final Degradation: If all synthesis providers are degraded, return formatted retrieved passages with an explicit banner: _"AI synthesis unavailable (all upstream providers degraded). Here are the relevant passages from your documents"_.

3. **Multi-Tier Query & Semantic Caching:**
   - **Tier 1 (Exact Query Cache):** Keyed on `hash(tenant_id, corpus_version, query, config)`. $O(1)$ lookup for identical repeat queries.
   - **Tier 2 (Semantic Cache):** Evaluates cosine similarity of query embeddings against recent entries. Threshold $\ge 0.98$ yields high precision for rephrased queries.
   - **Tier 3 (Postgres Embedding Cache):** Persistent `embedding_cache(content_sha256, model, embedding)` table prevents duplicate embedding computation.
   - **Invalidation Strategy:** Tenant-scoped `corpus_version` integer. When documents are uploaded or soft-deleted, `corpus_version` increments, instantly obsoleting stale cache entries without bulk deletes.

4. **Token Bucket Rate Limiting & Pre-Flight Quotas:**
   - In-memory / Redis token-bucket rate limiter enforcing user-level (20 req/min) and tenant-level (100 req/min) limits on `/chat`, returning standard HTTP 429 with `Retry-After` headers.
   - Pre-flight monthly quota enforcement querying aggregated cost from the `messages` table for the current billing cycle.

5. **Operational Health & Graceful Draining:**
   - `/health/live`: Fast container health probe.
   - `/health/ready`: Validates live PostgreSQL connectivity.
   - `SIGTERM` / `SIGINT` lifecycle listeners stop accepting new connections and drain active HTTP and background worker tasks before process exit.

## Consequences

- Guaranteed uptime and predictable response behavior under upstream third-party API outages.
- Significant reduction in LLM inference costs and latency for repeat or semantically equivalent questions.
- Multi-tenant fairness and strict budget guardrails.
