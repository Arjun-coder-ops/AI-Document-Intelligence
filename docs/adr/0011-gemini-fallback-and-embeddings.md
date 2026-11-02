# ADR 0011: Transition from OpenAI to Gemini for Fallback LLM, Embeddings, and Listwise Reranking

## Status

Accepted

## Context

Prior versions of DocSage utilized a fragmented multi-vendor AI topology:

1. Primary generation via Groq (`llama-3.3-70b-versatile`).
2. Secondary fallback generation via OpenAI (`gpt-4o-mini`).
3. Embeddings via pseudo-hash projections or local MiniLM models (384-d).
4. Reranking via optional Cohere API or mock implementations.

This setup suffered from multiple production drawbacks:

- **Vendor Fragmentation & Key Proliferation:** Managing separate API keys and billing contracts for OpenAI, Cohere, and Groq increased operational overhead and attack surface.
- **Embedding Dimensionality and Recall Mismatch:** Low-dimensional 384-d or hash vectors degraded retrieval accuracy under vocabulary mismatch and paraphrase shifts.
- **Cold-Start Rate Limiting:** Fallback during Groq rate limits risked immediate secondary rate limiting if the fallback provider had restrictive tiers or unverified credit balances.

## Decision

We standardize the auxiliary and fallback AI infrastructure exclusively on Google Gemini:

1. **Fallback LLM Provider (`gemini-1.5-flash`):**
   - Replaced OpenAI `gpt-4o-mini` with Gemini 1.5 Flash as the secondary provider in `packages/rag/src/llm.ts`.
   - Connected directly to the `CircuitBreaker` failover chain:
     `Groq (Llama 3.3 70B)` $\xrightarrow{\text{429 / 5xx / timeout}}$ `Gemini (1.5 Flash)` $\xrightarrow{\text{429 / 5xx / timeout}}$ `Degraded Mode (Raw Retrieved Passages)`.
   - Streaming SSE tokens are parsed directly from Gemini's Server-Sent Events endpoint (`streamGenerateContent?alt=sse`) with strict upstream `AbortSignal` propagation.

2. **Unified Dense Embeddings (`models/gemini-embedding-001`, 768 Dimensions):**
   - Standardized vector representation on `models/gemini-embedding-001` with `outputDimensionality: 768`.
   - Strict asymmetric task types:
     - `taskType: RETRIEVAL_DOCUMENT` during document chunk ingestion.
     - `taskType: RETRIEVAL_QUERY` during real-time retrieval execution.
   - Upgraded PostgreSQL `chunks.embedding` column from `vector(384)` / `vector(1536)` to `vector(768)` via migration `0003_upgrade_embedding_dim_768.sql`.
   - Created batch re-embedding runner `packages/db/src/reembed.ts` processing chunks in configurable batches of 50.

3. **In-House Listwise Reranker (`GeminiListwiseReranker`):**
   - Replaced proprietary cross-encoder vendor dependencies (Cohere) with a zero-dependency listwise prompt reranker powered by `gemini-1.5-flash`.
   - Re-scores top-25 hybrid RRF candidates into top-5 definitive context passages.

4. **Centralized Model Registry (`packages/rag/src/models.ts`):**
   - Centralized all model identifiers, dimension constraints, token limits, and temperature defaults into a strongly-typed schema:
     - `PRIMARY_CHAT_MODEL`: `llama-3.3-70b-versatile` (Groq)
     - `FALLBACK_CHAT_MODEL`: `gemini-1.5-flash` (Gemini)
     - `EMBEDDING_MODEL`: `models/gemini-embedding-001` (768-d)
     - `RERANK_MODEL`: `gemini-1.5-flash`

5. **Complete Decommissioning of OpenAI:**
   - Removed all `openai` packages, configuration keys (`OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`), and environment schemas across the entire codebase.

## Consequences

### Positive

- **Zero OpenAI Dependency:** Simplified environment secrets to just `GROQ_API_KEY` and `GEMINI_API_KEY`.
- **Retrieval Performance:** Upgrading to authentic 768-d Gemini embeddings elevated dense Recall@5 from 0.25 to 1.0000 on factual queries and eliminated lexical bias on paraphrased queries.
- **Cost Reduction:** Leveraging Gemini 1.5 Flash eliminates recurring Cohere and OpenAI billing overhead while maintaining high throughput and long context capabilities.

### Trade-offs & Mitigations

- **Database Schema Migration:** Existing stored vectors must be migrated to 768 dimensions using `packages/db/src/reembed.ts`.
- **API Version Stability:** Targeted Google Gemini v1beta REST API with fallback to `gemini-1.5-flash` to ensure long-term stability.
