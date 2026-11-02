import type { GoldenQuestion } from '../types.js';

export const COMPLEX_QUESTIONS: GoldenQuestion[] = [
  // ── 15 Multi-Hop Questions ────────────────────────────────────────────────
  {
    id: 'q-m01',
    question:
      'How do election timeouts relate to majority quorum voting when electing a leader in Raft?',
    expectedAnswer:
      'When a follower experiences an election timeout (150ms-300ms), it transitions to candidate, votes for itself, and requires votes from a majority quorum to win the election.',
    goldChunkIds: ['raft-c1', 'raft-c2'],
    type: 'multi-hop',
  },
  {
    id: 'q-m02',
    question:
      'How does client command execution in Raft lead to maintaining identical logs across cluster servers?',
    expectedAnswer:
      'The leader appends client commands to its log and sends AppendEntries RPCs; through the Log Matching Property, matching index and term guarantees all preceding entries are identical.',
    goldChunkIds: ['raft-c3', 'raft-c4'],
    type: 'multi-hop',
  },
  {
    id: 'q-m03',
    question:
      'How does HNSW graph navigation progress from upper skip-list layers down to the final vector ranking at layer 0?',
    expectedAnswer:
      'Navigation begins at the entry point of the sparsest top layer using greedy routing down each layer, until layer 0 where an efSearch beam search finds the nearest neighbors.',
    goldChunkIds: ['hnsw-c1', 'hnsw-c2'],
    type: 'multi-hop',
  },
  {
    id: 'q-m04',
    question: 'How does parameter m affect HNSW graph construction and dynamic search recall?',
    expectedAnswer:
      'Parameter m sets the maximum links per node, while efConstruction governs candidate pool size during indexing; higher values increase memory but improve recall.',
    goldChunkIds: ['hnsw-c2', 'hnsw-c3'],
    type: 'multi-hop',
  },
  {
    id: 'q-m05',
    question:
      'Why does incremental HNSW indexing with vector_cosine_ops eliminate the re-indexing maintenance required by IVFFlat?',
    expectedAnswer:
      'HNSW nodes are linked dynamically at insertion time using cosine distance without requiring global Voronoi centroid training, so vectors can be inserted without periodic rebuilds.',
    goldChunkIds: ['hnsw-c4', 'hnsw-c5'],
    type: 'multi-hop',
  },
  {
    id: 'q-m06',
    question:
      'How does raw text normalization in tsvector enable fast Boolean intersections using GIN indexes?',
    expectedAnswer:
      'Raw text is normalized into distinct stemmed lexemes in tsvector, and GIN indexes map each lexeme to tuple IDs, enabling multi-word searches via bitmap AND operations.',
    goldChunkIds: ['fts-c1', 'fts-c3'],
    type: 'multi-hop',
  },
  {
    id: 'q-m07',
    question:
      'How does websearch_to_tsquery parsing feed into ts_rank scoring for natural user queries?',
    expectedAnswer:
      'websearch_to_tsquery converts natural query syntax into valid tsquery expressions, which ts_rank scores against document tsvector based on term frequency and density.',
    goldChunkIds: ['fts-c2', 'fts-c4'],
    type: 'multi-hop',
  },
  {
    id: 'q-m08',
    question:
      'How does storing tsvector as a GENERATED column streamline GIN index synchronization during document updates?',
    expectedAnswer:
      'Because tsvector is GENERATED ALWAYS STORED, PostgreSQL automatically updates the lexemes and the corresponding GIN index posting lists in the same transaction.',
    goldChunkIds: ['fts-c3', 'fts-c5'],
    type: 'multi-hop',
  },
  {
    id: 'q-m09',
    question:
      'How does Row-Level Security combine with transaction-local set_config to prevent cross-tenant data leaks in PgBouncer?',
    expectedAnswer:
      'RLS policies evaluate app.tenant_id, and setting it via set_config with is_local=true ensures the configuration vanishes on commit, preventing leakage across pooled PgBouncer connections.',
    goldChunkIds: ['sec-c1', 'sec-c2'],
    type: 'multi-hop',
  },
  {
    id: 'q-m10',
    question:
      'How do short-lived JWT access tokens and rotating refresh cookies provide both high performance and fast revocation?',
    expectedAnswer:
      '15-minute JWT access tokens enable stateless verification without database roundtrips, while 7-day refresh tokens stored as hashes in PostgreSQL allow immediate revocation upon rotation or logout.',
    goldChunkIds: ['sec-c4'],
    type: 'multi-hop',
  },
  {
    id: 'q-m11',
    question:
      'How does Argon2id password verification protect against both online brute-force and side-channel cache attacks?',
    expectedAnswer:
      'Argon2id combines data-independent memory access (protecting against cache timing attacks) and data-dependent access with 64MB memory cost (resisting GPU brute force).',
    goldChunkIds: ['sec-c3'],
    type: 'multi-hop',
  },
  {
    id: 'q-m12',
    question:
      'How does an append-only audit log preserve accountability alongside RLS tenant isolation?',
    expectedAnswer:
      'Actions are recorded in audit_log with actor and tenant identifiers, and absence of UPDATE/DELETE privileges prevents attackers or tenants from modifying previous activity records.',
    goldChunkIds: ['sec-c1', 'sec-c5'],
    type: 'multi-hop',
  },
  {
    id: 'q-m13',
    question:
      'How do joint consensus transitions in Raft prevent split-brain during configuration changes?',
    expectedAnswer:
      'Joint consensus requires decisions to be approved by majorities of both the old and new configurations simultaneously, preventing separate uncoordinated majorities.',
    goldChunkIds: ['raft-c2', 'raft-c5'],
    type: 'multi-hop',
  },
  {
    id: 'q-m14',
    question:
      'How does cosine distance in pgvector relate to Euclidean distance when operating on normalized vectors?',
    expectedAnswer:
      'For normalized unit vectors, cosine distance (1 - cosine_similarity) is a monotonic transformation of squared Euclidean distance.',
    goldChunkIds: ['hnsw-c4'],
    type: 'multi-hop',
  },
  {
    id: 'q-m15',
    question:
      'How does greedy routing in HNSW compare to skip-list search efficiency in traditional 1D data structures?',
    expectedAnswer:
      'Greedy routing across sparse upper layers bypasses vast geometric distances similarly to high-level express lanes in 1D skip-lists, achieving O(log N) search time.',
    goldChunkIds: ['hnsw-c1', 'hnsw-c2'],
    type: 'multi-hop',
  },

  // ── 15 Keyword-Exact Questions ────────────────────────────────────────────
  {
    id: 'q-k01',
    question: 'What is the exact parameter name for search beam width in HNSW?',
    expectedAnswer: 'efSearch',
    goldChunkIds: ['hnsw-c2'],
    type: 'keyword-exact',
  },
  {
    id: 'q-k02',
    question: 'What is the exact parameter name for construction candidate list size in HNSW?',
    expectedAnswer: 'efConstruction',
    goldChunkIds: ['hnsw-c3'],
    type: 'keyword-exact',
  },
  {
    id: 'q-k03',
    question: 'What operator class in pgvector specifies cosine distance for HNSW?',
    expectedAnswer: 'vector_cosine_ops',
    goldChunkIds: ['hnsw-c4'],
    type: 'keyword-exact',
  },
  {
    id: 'q-k04',
    question:
      'What PostgreSQL function parses search queries with support for quotes and minus operators without throwing syntax errors?',
    expectedAnswer: 'websearch_to_tsquery',
    goldChunkIds: ['fts-c2'],
    type: 'keyword-exact',
  },
  {
    id: 'q-k05',
    question: 'What PostgreSQL index type is used for tsvector columns?',
    expectedAnswer: 'GIN',
    goldChunkIds: ['fts-c3'],
    type: 'keyword-exact',
  },
  {
    id: 'q-k06',
    question: 'What exact SQL function sets a transaction-local setting in PostgreSQL?',
    expectedAnswer: 'set_config',
    goldChunkIds: ['sec-c2'],
    type: 'keyword-exact',
  },
  {
    id: 'q-k07',
    question: 'What is the parameter is_local set to in set_config to prevent session leakage?',
    expectedAnswer: 'true',
    goldChunkIds: ['sec-c2'],
    type: 'keyword-exact',
  },
  {
    id: 'q-k08',
    question: 'What is the memory cost in KiB used for Argon2id hashing?',
    expectedAnswer: '65536 KiB (64MB)',
    goldChunkIds: ['sec-c3'],
    type: 'keyword-exact',
  },
  {
    id: 'q-k09',
    question: 'What is the time cost iteration count for Argon2id in DocSage?',
    expectedAnswer: '3 iterations',
    goldChunkIds: ['sec-c3'],
    type: 'keyword-exact',
  },
  {
    id: 'q-k10',
    question: 'What RPC is used by Raft candidates to collect votes?',
    expectedAnswer: 'RequestVote RPC',
    goldChunkIds: ['raft-c1'],
    type: 'keyword-exact',
  },
  {
    id: 'q-k11',
    question: 'What RPC is used by Raft leaders to replicate log entries and transmit heartbeats?',
    expectedAnswer: 'AppendEntries RPC',
    goldChunkIds: ['raft-c3'],
    type: 'keyword-exact',
  },
  {
    id: 'q-k12',
    question: 'What is the lower bound in milliseconds of the Raft randomized election timeout?',
    expectedAnswer: '150ms',
    goldChunkIds: ['raft-c2'],
    type: 'keyword-exact',
  },
  {
    id: 'q-k13',
    question: 'What is the upper bound in milliseconds of the Raft randomized election timeout?',
    expectedAnswer: '300ms',
    goldChunkIds: ['raft-c2'],
    type: 'keyword-exact',
  },
  {
    id: 'q-k14',
    question: 'What data type stores normalized lexemes in PostgreSQL?',
    expectedAnswer: 'tsvector',
    goldChunkIds: ['fts-c1'],
    type: 'keyword-exact',
  },
  {
    id: 'q-k15',
    question:
      'What hashing algorithm is used to hash refresh tokens before storing in the database?',
    expectedAnswer: 'SHA-256',
    goldChunkIds: ['sec-c4'],
    type: 'keyword-exact',
  },
];
