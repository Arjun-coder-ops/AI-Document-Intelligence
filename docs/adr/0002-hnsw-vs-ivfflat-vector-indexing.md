# ADR 0002: Vector Indexing Strategy — HNSW vs IVFFlat in pgvector

## Context

Retrieval-Augmented Generation (RAG) performance is bounded by vector search latency and retrieval recall. When storing vector embeddings in PostgreSQL via `pgvector`, an appropriate index method must be selected. Without an index, PostgreSQL executes exact $O(N)$ sequential scans (`IndexFlatL2` / brute-force cosine distance), which does not scale beyond a few thousand rows.

`pgvector` provides two principal approximate nearest neighbor (ANN) indexing algorithms:

1. **IVFFlat (Inverted File Flat)**
2. **HNSW (Hierarchical Navigable Small World)**

## Options Considered

### Option 1: IVFFlat

- **Mechanism:** Partitions the vector space into $C$ Voronoi cells via k-means clustering. At query time, only vectors inside the nearest $nprobes$ centroids are scanned.
- **Trade-offs:**
  - _Pros:_ Small index size (lightweight memory footprint); fast index creation time.
  - _Cons:_ Requires a training phase; cannot build an accurate index on an empty or sparsely populated table; index quality degrades severely as new vectors are inserted without re-clustering; lower recall at high query concurrency.

### Option 2: HNSW (Hierarchical Navigable Small World)

- **Mechanism:** Builds a multi-layer graph where lower layers contain dense connections between nearest vectors and higher layers contain sparse long-range connections. Search operates hierarchically from top to bottom.
- **Trade-offs:**
  - _Pros:_ Superior Recall-to-Latency ratio ($>95\%$ recall at sub-10ms queries); no training phase required (can be created on empty tables); robust to incremental inserts without index degradation; configurable `ef_search` parameter at query time.
  - _Cons:_ Higher build time and larger memory footprint compared to IVFFlat.

## Decision

Adopt **HNSW** (`vector_cosine_ops`) with parameters:

- `m = 16`: Number of bidirectional links established per node (balances graph connectivity and index size).
- `ef_construction = 64`: Size of dynamic candidate list during graph construction (ensures high index graph quality).
- Query runtime tuning: `SET hnsw.ef_search = 64` (configurable via application settings to balance latency vs recall).

```sql
CREATE INDEX idx_chunks_embedding_hnsw
ON chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

## Consequences & Trade-offs

- **Positive:** Predictable sub-10ms ANN queries across tens of thousands of chunks; consistent recall without requiring periodic index re-clustering jobs.
- **Negative:** Increased RAM consumption on the PostgreSQL instance. At extreme scale ($>10^7$ vectors), memory must be monitored, or product quantization (IVF-PQ) evaluated.
