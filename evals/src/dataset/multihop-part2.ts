import type { GoldenQuestion } from '../types.js';

export const MULTIHOP_PART2: GoldenQuestion[] = [
  {
    id: 'q-m19',
    question:
      'Why does greedy descent through sparse geometric tiers terminate in a fine-grained candidate priority queue at the base tier?',
    expectedAnswer:
      'Sparsely connected upper layers provide fast logarithmic skip-list traversal to locate the neighborhood, before layer 0 executes beam search of width efSearch for nearest neighbors.',
    goldChunkIds: ['hnsw-c1', 'hnsw-c3'],
    type: 'multi-hop',
    manualReviewStatus: 'pending',
  },
  {
    id: 'q-m20',
    question:
      'How do edge allocation limits per vertex balance high-dimensional semantic search recall against RAM allocation per embedding?',
    expectedAnswer:
      'Parameter m limits bidirectional links per node; higher values improve graph connectivity and recall but consume an additional 1-2KB of memory per vector beyond the float32 array.',
    goldChunkIds: ['hnsw-c2', 'hnsw-c4'],
    type: 'multi-hop',
    manualReviewStatus: 'pending',
  },
  {
    id: 'q-m21',
    question:
      'Why does non-rebuilding vector graph indexing yield operational benefits over clustered Voronoi partitions in dynamic databases?',
    expectedAnswer:
      'HNSW dynamically links new vectors using cosine distance at write time without requiring periodic global centroid retraining, avoiding the downtime associated with IVFFlat.',
    goldChunkIds: ['hnsw-c4', 'hnsw-c5'],
    type: 'multi-hop',
    manualReviewStatus: 'pending',
  },
  {
    id: 'q-m22',
    question:
      'How does linguistic stopword stripping and normalization prepare search terms for inverted posting list bitmap intersections?',
    expectedAnswer:
      'Input strings are converted into deduplicated lexemes stored as tsvector, allowing GIN indexes to map distinct lexeme keys to tuple IDs and perform fast boolean AND bitmap queries.',
    goldChunkIds: ['fts-c1', 'fts-c3'],
    type: 'multi-hop',
    manualReviewStatus: 'pending',
  },
  {
    id: 'q-m23',
    question:
      'In what manner does natural language search parsing prevent query aborts while calculating term density with document length penalties?',
    expectedAnswer:
      'websearch_to_tsquery sanitizes unclosed punctuation into valid tsquery expressions, which ts_rank scores against tsvector using term frequency normalized by document length.',
    goldChunkIds: ['fts-c2', 'fts-c4'],
    type: 'multi-hop',
    manualReviewStatus: 'pending',
  },
  {
    id: 'q-m24',
    question:
      'How does transaction-safe column precomputation ensure lexical posting lists stay in sync with document mutations without triggers?',
    expectedAnswer:
      'By declaring tsvector as GENERATED ALWAYS STORED, PostgreSQL updates lexemes and corresponding GIN posting lists synchronously inside the insert or update transaction.',
    goldChunkIds: ['fts-c3', 'fts-c5'],
    type: 'multi-hop',
    manualReviewStatus: 'pending',
  },
  {
    id: 'q-m25',
    question:
      'Why does tenant isolation enforced by database kernel policies require transaction-scoped configuration in pooled connection topologies?',
    expectedAnswer:
      'Database policies filter rows based on current_setting, but PgBouncer transaction pooling reuses backends; setting is_local true in set_config ensures context clears on commit.',
    goldChunkIds: ['sec-c1', 'sec-c2'],
    type: 'multi-hop',
    manualReviewStatus: 'pending',
  },
  {
    id: 'q-m26',
    question:
      'How do high memory footprint password algorithms and cryptographically hashed sliding session tokens create defense-in-depth against credential attacks?',
    expectedAnswer:
      'Argon2id with 64MB memory cost defeats GPU hash cracking, while 7-day rotating refresh tokens stored as SHA-256 hashes in PostgreSQL ensure stolen credentials can be instantly revoked.',
    goldChunkIds: ['sec-c3', 'sec-c4'],
    type: 'multi-hop',
    manualReviewStatus: 'pending',
  },
  {
    id: 'q-m27',
    question:
      'Why does an immutable audit ledger with restricted database privileges reinforce boundary isolation in multi-tenant environments?',
    expectedAnswer:
      'Row-Level Security isolates active tenant data while the audit_log table records actor actions without permitting UPDATE or DELETE, guaranteeing an unalterable compliance ledger.',
    goldChunkIds: ['sec-c1', 'sec-c5'],
    type: 'multi-hop',
    manualReviewStatus: 'pending',
  },
  {
    id: 'q-m28',
    question:
      'How does reciprocal rank fusion combine disjoint dense semantic proximity with exact lexical matches before listwise reranking?',
    expectedAnswer:
      'RRF combines the top-25 lexical and dense ranked lists using reciprocal rank summation with constant k=60, passing the top-20 merged candidates to the cross-attention reranker.',
    goldChunkIds: ['rrf-c1', 'rrf-c3'],
    type: 'multi-hop',
    manualReviewStatus: 'pending',
  },
  {
    id: 'q-m29',
    question:
      'In what way does relevance thresholding on top candidates prevent hallucinations when neither dense nor keyword channels exceed confidence floors?',
    expectedAnswer:
      'When maximum dense similarity drops below 0.58 and lexical score below 0.08, the pipeline short-circuits and abstains, preventing the LLM from generating ungrounded answers.',
    goldChunkIds: ['rrf-c2', 'rrf-c4'],
    type: 'multi-hop',
    manualReviewStatus: 'pending',
  },
  {
    id: 'q-m30',
    question:
      'How does first-stage candidate fusion under 25ms enable deep cross-attention reranking within a sub-100ms streaming budget?',
    expectedAnswer:
      'Fast PostgreSQL indexing retrieves top-25 candidates in under 25ms, leaving 30-70ms for listwise neural reranking to calibrate top-5 context before streaming generation starts.',
    goldChunkIds: ['rrf-c3', 'rrf-c5'],
    type: 'multi-hop',
    manualReviewStatus: 'pending',
  },
  {
    id: 'q-m31',
    question:
      'How does leader election upon missing heartbeats initiate subsequent parallel command broadcasting to all cluster followers?',
    expectedAnswer:
      'Followers timeout without heartbeats and transition to candidate to collect votes; upon winning, the leader immediately begins servicing client commands via AppendEntries RPCs.',
    goldChunkIds: ['raft-c1', 'raft-c3'],
    type: 'multi-hop',
    manualReviewStatus: 'pending',
  },
  {
    id: 'q-m32',
    question:
      'Why does the geometric skip-list structure of upper proximity layers permit sub-linear logarithmic nearest neighbor search?',
    expectedAnswer:
      'Higher HNSW graph tiers have long link lengths that bypass vast regions of vector space, descending greedily to layer 0 to achieve average O(log N) search complexity.',
    goldChunkIds: ['hnsw-c1', 'hnsw-c2'],
    type: 'multi-hop',
    manualReviewStatus: 'pending',
  },
  {
    id: 'q-m33',
    question:
      'How does database-enforced row filtering operate in conjunction with short-lived access grants to protect cross-tenant resources?',
    expectedAnswer:
      '15-minute JWT tokens assert authenticated tenant claims on API requests, while PostgreSQL Row-Level Security independently verifies tenant_id at the storage kernel level.',
    goldChunkIds: ['sec-c1', 'sec-c4'],
    type: 'multi-hop',
    manualReviewStatus: 'pending',
  },
  {
    id: 'q-m34',
    question:
      'How does natural search query syntax translation interact with automated stored column lexeme extraction during write transactions?',
    expectedAnswer:
      'websearch_to_tsquery translates user search phrases without syntax errors against GIN indexes populated automatically by GENERATED ALWAYS STORED tsvector columns.',
    goldChunkIds: ['fts-c2', 'fts-c5'],
    type: 'multi-hop',
    manualReviewStatus: 'pending',
  },
  {
    id: 'q-m35',
    question:
      'Why do reciprocal rank constants mitigate candidate scale differences when fusing lexical posting rankings with dense cosine projections?',
    expectedAnswer:
      'RRF converts disparate non-linear score magnitudes into pure ordinal ranks smoothed by parameter k=60, balancing exact keyword hits with dense semantic proximity.',
    goldChunkIds: ['rrf-c1', 'rrf-c2'],
    type: 'multi-hop',
    manualReviewStatus: 'pending',
  },
];
