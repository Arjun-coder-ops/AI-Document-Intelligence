# ADR 0005: Hybrid Search, Reciprocal Rank Fusion (RRF), and Cross-Encoder Reranking

## Status

Accepted

## Context

Standard RAG systems relying solely on dense vector embeddings suffer from distinct blind spots:

1. **Keyword-Exact Queries:** Acronyms, product SKUs, exact error codes, function names, and legal section identifiers (e.g. "Section 4.2(b)", "CVE-2024-21626", "ERR_INVALID_AUTH") frequently produce poor cosine similarity scores because embedding models compress them into generic semantic spaces.
2. **Dense False Positives:** Dense retrievers often retrieve passages that share broad conceptual themes with the query but lack the specific keyword or entity requested.
3. **Sparse/Lexical Blind Spots:** Pure BM25 / PostgreSQL full-text search (`tsvector`) fails when queries use synonyms, paraphrasing, or conceptual abstractions without exact token matches.
4. **Prompt Injection & Hallucinated Citations:** When retrieved context is concatenated blindly into LLM prompts without structured delimiters, models are vulnerable to context injection attacks and generate phantom citations referencing non-existent sources.

## Decision

We designed a multi-stage retrieval and verification pipeline:

1. **Two-Stage Hybrid Candidate Generation in PostgreSQL:**
   - **Dense Retrieval:** Retrieves top-25 passages using cosine distance over `pgvector` HNSW index (`chunks.embedding <=> $query_embedding`), with configurable `hnsw.ef_search` per transaction.
   - **Lexical Retrieval:** Retrieves top-25 passages using PostgreSQL native full-text search (`websearch_to_tsquery('english', $query)` matched against generated stored `chunks.tsv` and scored with `ts_rank`).
2. **Reciprocal Rank Fusion (RRF):**
   - Merges dense and lexical candidate lists without requiring cross-modality score calibration:
     $$RRFScore(d) = \sum_{m \in \{dense, lexical\}} \frac{1}{k + rank_m(d)}$$
   - Parameter $k = 60$ acts as a smoothing constant to prevent top-rank outliers from monopolizing the merged list.
   - Candidates appearing in both modalities receive additive scores, boosting documents with both semantic and keyword relevance.
3. **Cross-Encoder / Reranker Interface:**
   - Evaluates the top-20 fused candidates to extract the most salient top-5 passages.
   - Decoupled behind a `Reranker` interface:
     - `ListwiseLLMReranker`: Prompt-based listwise reranking without external provider dependencies.
     - `CohereReranker`: State-of-the-art cross-encoder (`rerank-v3.5`) when API key is provided.
     - `MockReranker` / `NoOpReranker`: For deterministic offline CI tests and evals.
4. **Relevance Threshold Gating:**
   - If the maximum candidate score fails to meet the tuned relevance cutoff, the pipeline short-circuits: returns an honest "not found in your documents" response with 0 citations, skipping the LLM call entirely.
5. **Defensive Prompt Sandboxing & Citation Verification:**
   - Passages are enclosed in `<context><chunk id="n" document="..." page="...">...</chunk></context>` XML delimiters.
   - System prompt explicitly enforces untrusted data boundaries and mandates inline `[n]` citations.
   - A deterministic parser extracts all `[n]` citation tokens, verifies each against the provided chunks, strips hallucinated markers, and returns structured citation metadata (`documentTitle`, `page`, `snippet`).

## Trade-offs and Alternatives Considered

- **Linear Weighted Score Combination ($\alpha \cdot \text{dense} + (1-\alpha) \cdot \text{sparse}$):** Rejected. Cosine similarity ($[-1, 1]$) and `ts_rank` ($[0, \infty)$) have vastly different, non-stationary score distributions across different queries. Normalizing them requires query-dependent calibration, which is brittle and prone to drift. RRF is rank-based, parameter-insensitive, and robust across document collections.
- **Dedicated Vector Database (Pinecone/Qdrant):** Rejected for current scale. Storing chunks, vectors, full-text indexes, and metadata in the same PostgreSQL database enables single-transaction ACID consistency and eliminates cross-system sync latency.
- **Bi-Encoder Only Reranking:** Rejected. Cross-encoders examine full cross-attention between query and passage tokens simultaneously, yielding significantly higher precision than bi-encoders for the top-5 selection stage.

## Consequences

- High precision and recall across both factual/keyword queries and conceptual queries.
- Zero extra latency or API costs when user questions are unanswerable from the uploaded documents.
- Hallucinated citations are eliminated at the verification layer before reaching the user.
