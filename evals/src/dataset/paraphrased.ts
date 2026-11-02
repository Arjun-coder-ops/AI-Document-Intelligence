import type { GoldenQuestion } from '../types.js';

export const PARAPHRASED_QUESTIONS: GoldenQuestion[] = [
  {
    id: 'q-p01',
    question:
      'How does an unassigned peer node detect the failure of an authoritative coordinator and begin campaigning for authority?',
    expectedAnswer:
      'When heartbeats cease and an election timeout elapses, the follower increments its term and enters candidate state to solicit votes.',
    goldChunkIds: ['raft-c1'],
    type: 'paraphrased',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-p02',
    question:
      'By what mechanism does the distributed consensus group eliminate simultaneous candidacy deadlocks, and what threshold of agreement secures victory?',
    expectedAnswer:
      'Randomized intervals between 150ms and 300ms mitigate split votes, and winning requires unanimous confirmation from over half the cluster.',
    goldChunkIds: ['raft-c2'],
    type: 'paraphrased',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-p03',
    question:
      'Describe the workflow through which incoming application instructions from external callers are propagated across the cluster after a primary server is chosen.',
    expectedAnswer:
      'The elected primary inserts commands into its sequential record and broadcasts replication messages concurrently to all subordinates.',
    goldChunkIds: ['raft-c3'],
    type: 'paraphrased',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-p04',
    question:
      'What invariant guarantees historical ledger consistency across replicas sharing identical term numbers and sequence positions?',
    expectedAnswer:
      'The Log Matching Property guarantees that matching index and term implies identical stored commands and identical history up to that position.',
    goldChunkIds: ['raft-c4'],
    type: 'paraphrased',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-p05',
    question:
      'How can a live cluster dynamically adjust its roster of participating member machines without halting operations or introducing split-brain risks?',
    expectedAnswer:
      'A dual-stage joint configuration transition commits journal items under both legacy and revised membership configurations concurrently.',
    goldChunkIds: ['raft-c5'],
    type: 'paraphrased',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-p06',
    question:
      'How does the multi-tier spatial graph accelerate approximate nearest neighbor routing using an analog of probabilistic skip-lists?',
    expectedAnswer:
      'HNSW stratifies embeddings into layered proximity graphs where higher levels feature wider strides for logarithmic skip-list traversal.',
    goldChunkIds: ['hnsw-c1'],
    type: 'paraphrased',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-p07',
    question:
      'Walk through the traversal path from initial entry to base tier during query execution, including asymptotic time efficiency.',
    expectedAnswer:
      'Routing descends greedily through hierarchical tiers before running beam exploration on level 0 with logarithmic O(log N) average complexity.',
    goldChunkIds: ['hnsw-c2'],
    type: 'paraphrased',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-p08',
    question:
      'Which tuning knob dictates edge density per vertex and what architectural consequence does increasing this value have on RAM consumption?',
    expectedAnswer:
      'Parameter m sets bidirectional degree constraints, where larger allocations improve recall at the expense of higher memory usage.',
    goldChunkIds: ['hnsw-c3'],
    type: 'paraphrased',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-p09',
    question:
      'Under unit norm constraints, what is the geometric relationship between angular separation and straight-line Euclidean distance in the indexing extension?',
    expectedAnswer:
      'For normalized vectors, cosine distance is monotonically equivalent to transformed Euclidean separation via 1 minus cosine similarity.',
    goldChunkIds: ['hnsw-c4'],
    type: 'paraphrased',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-p10',
    question:
      'Why is the graph-based indexing strategy preferable for dynamic real-time workloads compared to centroid-partitioned schemes like inverted files?',
    expectedAnswer:
      'HNSW permits continuous incremental point mutations without necessitating post-hoc centroid recalculation or index rebuilds.',
    goldChunkIds: ['hnsw-c5'],
    type: 'paraphrased',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-p11',
    question:
      'What internal representation does the database engine construct to store stemmed, stopword-filtered lexical tokens extracted from arbitrary text?',
    expectedAnswer:
      'PostgreSQL compiles input strings into tsvector structures containing deduplicated sorted lexemes normalized by linguistic dictionaries.',
    goldChunkIds: ['fts-c1'],
    type: 'paraphrased',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-p12',
    question:
      'How does the search parser safely handle raw user input containing unescaped quotation marks and search modifiers without crashing?',
    expectedAnswer:
      'The websearch parser tolerates unclosed punctuation and interprets phrase adjacencies using the FOLLOWED BY proximity operator.',
    goldChunkIds: ['fts-c2'],
    type: 'paraphrased',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-p13',
    question:
      'What underlying index mechanism associates individual vocabulary terms with disk tuple identifiers to accelerate multi-term boolean retrieval?',
    expectedAnswer:
      'GIN indexes maintain posting arrays mapping distinct lexeme keys to physical row pointers, executing fast bitmap intersection across criteria.',
    goldChunkIds: ['fts-c3'],
    type: 'paraphrased',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-p14',
    question:
      'How does the built-in textual scoring algorithm evaluate document quality while mitigating unfair bias toward excessively long articles?',
    expectedAnswer:
      'Ranking computes lexeme density and occurrences while applying logarithmic document length penalties to prevent length inflation.',
    goldChunkIds: ['fts-c4'],
    type: 'paraphrased',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-p15',
    question:
      'How can database designers ensure textual tokenization occurs during write operations rather than consuming CPU during read queries, without writing custom triggers?',
    expectedAnswer:
      'Persisting tsvectors within GENERATED ALWAYS AS STORED columns automates lexical extraction in the insertion transaction without custom triggers.',
    goldChunkIds: ['fts-c5'],
    type: 'paraphrased',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-p16',
    question:
      'How does the platform prevent accidental cross-organization data leakage at the storage tier even if an engineer writes a query without tenant scoping predicates?',
    expectedAnswer:
      'Engine-level Row-Level Security policies evaluate current_setting parameters to restrict row visibility automatically across all queries.',
    goldChunkIds: ['sec-c1'],
    type: 'paraphrased',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-p17',
    question:
      'Why is traditional session-level configuration hazardous in environments using transaction-level connection proxies, and how is parameter isolation maintained?',
    expectedAnswer:
      'Session variables bleed across pooled clients; setting is_local true inside set_config rolls back tenant context immediately at transaction boundary.',
    goldChunkIds: ['sec-c2'],
    type: 'paraphrased',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-p18',
    question:
      'What cryptographic primitive and computational hardness configuration protect stored user credentials against dedicated hardware cracking arrays?',
    expectedAnswer:
      'Argon2id configured with 64MB memory, 3 iterations, and 4 threads provides memory-hard protection against ASIC and GPU brute forcing.',
    goldChunkIds: ['sec-c3'],
    type: 'paraphrased',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-p19',
    question:
      'Explain the token lifecycle strategy that prevents stolen session credentials from being reused while defending against cross-site scripting extraction.',
    expectedAnswer:
      'Short 15-minute access grants pair with 7-day single-use rotating refresh tokens stored as cryptographic hashes and guarded by httpOnly cookie attributes.',
    goldChunkIds: ['sec-c4'],
    type: 'paraphrased',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-p20',
    question:
      'How is the provenance and modification history of critical events protected from tampering or deletion by compromised application services?',
    expectedAnswer:
      'An append-only audit ledger where the application database principal lacks update and delete capabilities guarantees tamper-proof accounting.',
    goldChunkIds: ['sec-c5'],
    type: 'paraphrased',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-p21',
    question:
      'What sequence of events transitions an idle peer into an acknowledged leader authorized to accept external state transitions?',
    expectedAnswer:
      'An election timeout prompts candidate status, votes are gathered from a cluster majority, and the new leader commences accepting caller instructions.',
    goldChunkIds: ['raft-c1', 'raft-c3'],
    type: 'paraphrased',
    manualReviewStatus: 'verified-human',
  },
  {
    id: 'q-p22',
    question:
      'How does metric space selection influence proximity navigation across hierarchical skip-list layers?',
    expectedAnswer:
      'Vector distance operators such as cosine distance dictate edge traversal criteria across multi-layer graphs to discover nearest neighbors.',
    goldChunkIds: ['hnsw-c1', 'hnsw-c4'],
    type: 'paraphrased',
    manualReviewStatus: 'verified-human',
  },
];
