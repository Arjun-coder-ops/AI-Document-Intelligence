import type { GoldenQuestion } from '../types.js';

export const MULTIHOP_PART1: GoldenQuestion[] = [
  // ── Existing 15 Multi-Hop Questions (Verified Human) ──────────────────────
  {
    id: 'q-m01',
    question:
      'How do election timeouts relate to majority quorum voting when electing a leader in Raft?',
    expectedAnswer:
      'When a follower experiences an election timeout (150ms-300ms), it transitions to candidate, votes for itself, and requires votes from a majority quorum to win the election.',
    goldChunkIds: ['raft-c1', 'raft-c2'],
    type: 'multi-hop',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-m02',
    question:
      'How does client command execution in Raft lead to maintaining identical logs across cluster servers?',
    expectedAnswer:
      'The leader appends client commands to its log and sends AppendEntries RPCs; through the Log Matching Property, matching index and term guarantees all preceding entries are identical.',
    goldChunkIds: ['raft-c3', 'raft-c4'],
    type: 'multi-hop',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-m03',
    question:
      'How does HNSW graph navigation progress from upper skip-list layers down to the final vector ranking at layer 0?',
    expectedAnswer:
      'Navigation begins at the entry point of the sparsest top layer using greedy routing down each layer, until layer 0 where an efSearch beam search finds the nearest neighbors.',
    goldChunkIds: ['hnsw-c1', 'hnsw-c2'],
    type: 'multi-hop',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-m04',
    question: 'How does parameter m affect HNSW graph construction and dynamic search recall?',
    expectedAnswer:
      'Parameter m sets the maximum links per node, while efConstruction governs candidate pool size during indexing; higher values increase memory but improve recall.',
    goldChunkIds: ['hnsw-c2', 'hnsw-c3'],
    type: 'multi-hop',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-m05',
    question:
      'Why does incremental HNSW indexing with vector_cosine_ops eliminate the re-indexing maintenance required by IVFFlat?',
    expectedAnswer:
      'HNSW nodes are linked dynamically at insertion time using cosine distance without requiring global Voronoi centroid training, so vectors can be inserted without periodic rebuilds.',
    goldChunkIds: ['hnsw-c4', 'hnsw-c5'],
    type: 'multi-hop',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-m06',
    question:
      'How does raw text normalization in tsvector enable fast Boolean intersections using GIN indexes?',
    expectedAnswer:
      'Raw text is normalized into distinct stemmed lexemes in tsvector, and GIN indexes map each lexeme to tuple IDs, enabling multi-word searches via bitmap AND operations.',
    goldChunkIds: ['fts-c1', 'fts-c3'],
    type: 'multi-hop',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-m07',
    question:
      'How does websearch_to_tsquery parsing feed into ts_rank scoring for natural user queries?',
    expectedAnswer:
      'websearch_to_tsquery converts natural query syntax into valid tsquery expressions, which ts_rank scores against document tsvector based on term frequency and density.',
    goldChunkIds: ['fts-c2', 'fts-c4'],
    type: 'multi-hop',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-m08',
    question:
      'How does storing tsvector as a GENERATED column streamline GIN index synchronization during document updates?',
    expectedAnswer:
      'Because tsvector is GENERATED ALWAYS STORED, PostgreSQL automatically updates the lexemes and the corresponding GIN index posting lists in the same transaction.',
    goldChunkIds: ['fts-c3', 'fts-c5'],
    type: 'multi-hop',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-m09',
    question:
      'How does Row-Level Security combine with transaction-local set_config to prevent cross-tenant data leaks in PgBouncer?',
    expectedAnswer:
      'RLS policies evaluate app.tenant_id, and setting it via set_config with is_local=true ensures the configuration vanishes on commit, preventing leakage across pooled PgBouncer connections.',
    goldChunkIds: ['sec-c1', 'sec-c2'],
    type: 'multi-hop',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-m10',
    question:
      'How do short-lived JWT access tokens and rotating refresh cookies provide both high performance and fast revocation?',
    expectedAnswer:
      '15-minute JWT access tokens enable stateless verification without database roundtrips, while 7-day refresh tokens stored as hashes in PostgreSQL allow immediate revocation upon rotation or logout.',
    goldChunkIds: ['sec-c4'],
    type: 'multi-hop',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-m11',
    question:
      'How does Argon2id password verification protect against both online brute-force and side-channel cache attacks?',
    expectedAnswer:
      'Argon2id combines data-independent memory access (protecting against cache timing attacks) and data-dependent access with 64MB memory cost (resisting GPU brute force).',
    goldChunkIds: ['sec-c3'],
    type: 'multi-hop',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-m12',
    question:
      'How does an append-only audit log preserve accountability alongside RLS tenant isolation?',
    expectedAnswer:
      'Actions are recorded in audit_log with actor and tenant identifiers, and absence of UPDATE/DELETE privileges prevents attackers or tenants from modifying previous activity records.',
    goldChunkIds: ['sec-c1', 'sec-c5'],
    type: 'multi-hop',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-m13',
    question:
      'How do joint consensus transitions in Raft prevent split-brain during configuration changes?',
    expectedAnswer:
      'Joint consensus requires decisions to be approved by majorities of both the old and new configurations simultaneously, preventing separate uncoordinated majorities.',
    goldChunkIds: ['raft-c2', 'raft-c5'],
    type: 'multi-hop',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-m14',
    question:
      'How does cosine distance in pgvector relate to Euclidean distance when operating on normalized vectors?',
    expectedAnswer:
      'For normalized unit vectors, cosine distance (1 - cosine_similarity) is a monotonic transformation of squared Euclidean distance.',
    goldChunkIds: ['hnsw-c4'],
    type: 'multi-hop',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-m15',
    question:
      'How does greedy routing in HNSW compare to skip-list search efficiency in traditional 1D data structures?',
    expectedAnswer:
      'Greedy routing across sparse upper layers bypasses vast geometric distances similarly to high-level express lanes in 1D skip-lists, achieving O(log N) search time.',
    goldChunkIds: ['hnsw-c1', 'hnsw-c2'],
    type: 'multi-hop',
    manualReviewStatus: 'verified-human',
  },

  // ── 3 Low-Overlap Multi-Hop Questions (Pending Human Review) ─────────────
  {
    id: 'q-m16',
    question:
      'How does the leader command replication loop interact with the Log Matching Property to ensure follower state machines execute identical instruction histories?',
    expectedAnswer:
      'The leader transmits commands via AppendEntries, and the induction invariant of the Log Matching Property ensures matching index and term guarantees identical prior entries.',
    goldChunkIds: ['raft-c3', 'raft-c4'],
    type: 'multi-hop',
    manualReviewStatus: 'pending',
  },
  {
    id: 'q-m17',
    question:
      'In what way does randomized timer duration prevent competing candidates from dividing votes while transitioning to candidate status?',
    expectedAnswer:
      'Uniformly distributed randomized timeouts between 150ms and 300ms desynchronize followers upon heartbeat failure, allowing a single server to solicit a decisive majority.',
    goldChunkIds: ['raft-c1', 'raft-c2'],
    type: 'multi-hop',
    manualReviewStatus: 'pending',
  },
  {
    id: 'q-m18',
    question:
      'How does the two-phase cluster reconfiguration scheme rely on majority agreement across distinct membership generations?',
    expectedAnswer:
      'Joint consensus prevents uncoordinated majorities by requiring dual agreement from majorities of both the outgoing configuration and incoming configuration before committing.',
    goldChunkIds: ['raft-c2', 'raft-c5'],
    type: 'multi-hop',
    manualReviewStatus: 'pending',
  },
];
