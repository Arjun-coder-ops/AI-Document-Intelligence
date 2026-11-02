import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { CorpusChunk, GoldenQuestion } from './types.js';

export const CORPUS: CorpusChunk[] = [
  // ── Document 1: Raft Consensus ──────────────────────────────────────────────
  {
    id: 'raft-c1',
    documentTitle: 'Raft Consensus Algorithm Specification',
    section: 'Leader Election',
    page: 1,
    content:
      'In Raft, leader election is initiated when a follower node experiences an election timeout without receiving heartbeats. Followers increment their currentTerm and transition to the candidate state, immediately voting for themselves and sending RequestVote RPCs to all peers in the cluster.',
    tokens: 48,
  },
  {
    id: 'raft-c2',
    documentTitle: 'Raft Consensus Algorithm Specification',
    section: 'Election Safety and Randomization',
    page: 2,
    content:
      'To prevent split votes among competing candidates, Raft utilizes randomized election timeouts chosen uniformly from a range of 150ms to 300ms. A candidate wins an election if it receives votes from a strict majority of servers in the cluster for the same term.',
    tokens: 49,
  },
  {
    id: 'raft-c3',
    documentTitle: 'Raft Consensus Algorithm Specification',
    section: 'Log Replication and Invariants',
    page: 3,
    content:
      'Once a leader is elected, it begins servicing client requests. Each client request contains a command to be executed by the replicated state machines. The leader appends the command to its log as a new entry and issues AppendEntries RPCs in parallel to all other servers to replicate the entry.',
    tokens: 52,
  },
  {
    id: 'raft-c4',
    documentTitle: 'Raft Consensus Algorithm Specification',
    section: 'Log Matching Property',
    page: 4,
    content:
      'Raft maintains the Log Matching Property: if two entries in different logs have the same index and term, then they store the same command, and their logs are identical in all preceding entries up to that index. Leaders never overwrite or truncate their own logs.',
    tokens: 49,
  },
  {
    id: 'raft-c5',
    documentTitle: 'Raft Consensus Algorithm Specification',
    section: 'Cluster Membership Changes',
    page: 5,
    content:
      'Configuration changes use a two-phase joint consensus approach. Joint consensus allows individual servers to transition between configurations at different times without compromising safety. During joint consensus, log entries are committed under both old and new configurations simultaneously.',
    tokens: 46,
  },

  // ── Document 2: HNSW Vector Search ──────────────────────────────────────────
  {
    id: 'hnsw-c1',
    documentTitle: 'HNSW Graph Indexing Principles',
    section: 'Graph Layer Hierarchy',
    page: 1,
    content:
      'Hierarchical Navigable Small World (HNSW) graphs structure high-dimensional vector embeddings into multi-layer proximity graphs. The top layer has the longest link lengths and sparsest connections, acting as a geometric skip-list, while layer 0 contains all vectors connected to their nearest neighbors.',
    tokens: 51,
  },
  {
    id: 'hnsw-c2',
    documentTitle: 'HNSW Graph Indexing Principles',
    section: 'Search Complexity and Greedy Routing',
    page: 2,
    content:
      'Vector search in HNSW begins at the top-layer entry point and executes greedy routing to find the local minimum. Routing switches down one layer at a time until reaching layer 0, where an exploratory beam search of width efSearch is executed. Average search complexity scales logarithmically as O(log N).',
    tokens: 53,
  },
  {
    id: 'hnsw-c3',
    documentTitle: 'HNSW Graph Indexing Principles',
    section: 'Indexing Parameters m and efConstruction',
    page: 3,
    content:
      'The indexing parameter m defines the maximum number of bidirectional outgoing links per node, typically set between 16 and 64. Higher m improves recall on complex clustered datasets but increases index memory footprint. Parameter efConstruction controls the size of the dynamic candidate list during graph construction.',
    tokens: 53,
  },
  {
    id: 'hnsw-c4',
    documentTitle: 'HNSW Graph Indexing Principles',
    section: 'Distance Metrics and Cosine Space',
    page: 4,
    content:
      'In PostgreSQL pgvector, HNSW supports vector_cosine_ops for cosine distance, vector_l2_ops for Euclidean distance, and vector_ip_ops for inner product. For normalized unit vectors, cosine distance is equivalent to monotonic transformation of squared Euclidean distance: 1 - cosine_similarity.',
    tokens: 49,
  },
  {
    id: 'hnsw-c5',
    documentTitle: 'HNSW Graph Indexing Principles',
    section: 'Index Maintenance and Memory Layout',
    page: 5,
    content:
      'Unlike inverted file indexes (IVFFlat) that require post-hoc centroids training and periodic maintenance, HNSW is an incremental index structure. Vectors can be inserted and deleted continuously without recomputing global Voronoi partitions or degrading search accuracy.',
    tokens: 44,
  },

  // ── Document 3: PostgreSQL Full-Text Search ─────────────────────────────────
  {
    id: 'fts-c1',
    documentTitle: 'PostgreSQL Full-Text Search Architecture',
    section: 'tsvector Representation',
    page: 1,
    content:
      'PostgreSQL full-text search converts raw unstructured document strings into the tsvector data type. A tsvector represents a sorted list of distinct normalized lexemes, stripped of capitalization, punctuation, and English stopwords according to the active text search dictionary.',
    tokens: 45,
  },
  {
    id: 'fts-c2',
    documentTitle: 'PostgreSQL Full-Text Search Architecture',
    section: 'websearch_to_tsquery Operator',
    page: 2,
    content:
      'The websearch_to_tsquery function parses natural user search expressions without throwing syntax errors on unclosed quotes or operators. It understands boolean AND by default, OR operators, minus signs for negation, and quoted phrases as adjacent phrase matching with the FOLLOWED BY (<->) operator.',
    tokens: 51,
  },
  {
    id: 'fts-c3',
    documentTitle: 'PostgreSQL Full-Text Search Architecture',
    section: 'GIN Index Structure',
    page: 3,
    content:
      'Generalized Inverted Indexes (GIN) provide efficient lexical lookup for tsvector columns. GIN indexes store individual lexemes as keys, each mapped to a posting list of tuple IDs (TIDs). Multi-word search performs fast bitmap AND intersections across posting lists.',
    tokens: 44,
  },
  {
    id: 'fts-c4',
    documentTitle: 'PostgreSQL Full-Text Search Architecture',
    section: 'ts_rank Scoring Formulation',
    page: 4,
    content:
      'The ts_rank function computes relevance scores based on lexeme frequency (TF). It rewards documents where query terms appear multiple times and takes into account term density and document length normalization, with options to penalize long documents logarithmically.',
    tokens: 42,
  },
  {
    id: 'fts-c5',
    documentTitle: 'PostgreSQL Full-Text Search Architecture',
    section: 'Generated Columns Integration',
    page: 5,
    content:
      'Storing tsvector as a GENERATED ALWAYS AS (to_tsvector("english", content)) STORED column avoids runtime parsing overhead during search queries. The GIN index updates automatically in the same transaction as row insertions or updates without triggers.',
    tokens: 44,
  },

  // ── Document 4: Multi-Tenancy and Security ──────────────────────────────────
  {
    id: 'sec-c1',
    documentTitle: 'Multi-Tenant Security and Isolation Architecture',
    section: 'PostgreSQL Row-Level Security',
    page: 1,
    content:
      'PostgreSQL Row-Level Security (RLS) restricts row access at the database engine level. By defining policies using tenant_id = NULLIF(current_setting("app.tenant_id", true), "")::uuid, every SQL query automatically filters rows to the authenticated tenant, even when application queries omit WHERE clauses.',
    tokens: 49,
  },
  {
    id: 'sec-c2',
    documentTitle: 'Multi-Tenant Security and Isolation Architecture',
    section: 'Transaction-Local Configuration and Connection Pooling',
    page: 2,
    content:
      'Neon uses PgBouncer in transaction pooling mode. Setting session parameters via SET can leak across pooled connections. To guarantee safety, all tenant scoping must execute SELECT set_config("app.tenant_id", $1, true) where is_local=true ensures settings revert on transaction commit or rollback.',
    tokens: 51,
  },
  {
    id: 'sec-c3',
    documentTitle: 'Multi-Tenant Security and Isolation Architecture',
    section: 'Argon2id Hashing Parameters',
    page: 3,
    content:
      'Password authentication uses Argon2id with memory cost of 64MB (65536 KiB), time cost of 3 iterations, and parallelism of 4 threads. Argon2id provides state-of-the-art resistance against both side-channel cache attacks and GPU-accelerated brute-force attacks.',
    tokens: 44,
  },
  {
    id: 'sec-c4',
    documentTitle: 'Multi-Tenant Security and Isolation Architecture',
    section: 'JWT Access and Revocable Refresh Tokens',
    page: 4,
    content:
      'DocSage implements 15-minute short-lived JWT access tokens alongside rotating 7-day refresh tokens. Refresh tokens are stored in PostgreSQL as SHA-256 hashes and delivered exclusively via httpOnly, secure, SameSite cookies. Refreshing rotates the token and revokes previous tokens.',
    tokens: 47,
  },
  {
    id: 'sec-c5',
    documentTitle: 'Multi-Tenant Security and Isolation Architecture',
    section: 'Immutable Audit Trail',
    page: 5,
    content:
      'The audit_log table provides an append-only ledger recording actor_id, action, entity, entity_id, metadata, and UTC timestamp. The application database user lacks UPDATE and DELETE privileges on audit_log to guarantee tamper-proof auditability for compliance.',
    tokens: 45,
  },
];

// 65 Golden Questions (25 factual, 15 multi-hop, 15 keyword-exact, 10 unanswerable)
export const GOLDEN_QUESTIONS: GoldenQuestion[] = [
  // ── 25 Factual Questions ──────────────────────────────────────────────────
  {
    id: 'q-f01',
    question: 'What triggers a leader election in the Raft consensus algorithm?',
    expectedAnswer: 'An election is triggered when a follower experiences an election timeout without receiving heartbeats from a leader.',
    goldChunkIds: ['raft-c1'],
    type: 'factual',
  },
  {
    id: 'q-f02',
    question: 'What randomized timeout range does Raft use to prevent split votes?',
    expectedAnswer: 'Raft uses randomized election timeouts between 150ms and 300ms.',
    goldChunkIds: ['raft-c2'],
    type: 'factual',
  },
  {
    id: 'q-f03',
    question: 'How does a Raft candidate win an election?',
    expectedAnswer: 'A candidate wins by receiving votes from a strict majority of servers in the cluster for the same term.',
    goldChunkIds: ['raft-c2'],
    type: 'factual',
  },
  {
    id: 'q-f04',
    question: 'How does a Raft leader replicate commands to follower nodes?',
    expectedAnswer: 'The leader appends the command to its log and issues AppendEntries RPCs in parallel to all other servers.',
    goldChunkIds: ['raft-c3'],
    type: 'factual',
  },
  {
    id: 'q-f05',
    question: 'Do Raft leaders ever overwrite or truncate their own logs?',
    expectedAnswer: 'No, leaders never overwrite or truncate their own logs.',
    goldChunkIds: ['raft-c4'],
    type: 'factual',
  },
  {
    id: 'q-f06',
    question: 'What approach does Raft use for cluster configuration changes?',
    expectedAnswer: 'Raft uses a two-phase joint consensus approach.',
    goldChunkIds: ['raft-c5'],
    type: 'factual',
  },
  {
    id: 'q-f07',
    question: 'How are vector layers structured in an HNSW index?',
    expectedAnswer: 'HNSW structures vectors into a multi-layer proximity graph where upper layers have longer links and sparser connections, and layer 0 contains all vectors.',
    goldChunkIds: ['hnsw-c1'],
    type: 'factual',
  },
  {
    id: 'q-f08',
    question: 'What routing strategy does HNSW use across graph layers?',
    expectedAnswer: 'HNSW uses greedy routing from the top-layer entry point down to layer 0, followed by a beam search of width efSearch.',
    goldChunkIds: ['hnsw-c2'],
    type: 'factual',
  },
  {
    id: 'q-f09',
    question: 'What is the average search time complexity in an HNSW graph?',
    expectedAnswer: 'Search complexity scales logarithmically as O(log N).',
    goldChunkIds: ['hnsw-c2'],
    type: 'factual',
  },
  {
    id: 'q-f10',
    question: 'What does parameter m represent in HNSW graph construction?',
    expectedAnswer: 'Parameter m defines the maximum number of bidirectional outgoing links per node.',
    goldChunkIds: ['hnsw-c3'],
    type: 'factual',
  },
  {
    id: 'q-f11',
    question: 'What distance metric in pgvector is used for cosine distance in HNSW?',
    expectedAnswer: 'The vector_cosine_ops operator class is used for cosine distance.',
    goldChunkIds: ['hnsw-c4'],
    type: 'factual',
  },
  {
    id: 'q-f12',
    question: 'Does HNSW require post-hoc centroids training like IVFFlat?',
    expectedAnswer: 'No, HNSW is an incremental structure that allows continuous inserts and deletes without centroids training.',
    goldChunkIds: ['hnsw-c5'],
    type: 'factual',
  },
  {
    id: 'q-f13',
    question: 'What is the PostgreSQL tsvector data type?',
    expectedAnswer: 'tsvector is a sorted list of distinct normalized lexemes with stopwords and punctuation stripped.',
    goldChunkIds: ['fts-c1'],
    type: 'factual',
  },
  {
    id: 'q-f14',
    question: 'How does websearch_to_tsquery handle natural search phrases?',
    expectedAnswer: 'It parses search queries safely without syntax errors on unclosed quotes, supporting AND, OR, negation with minus, and quoted phrases.',
    goldChunkIds: ['fts-c2'],
    type: 'factual',
  },
  {
    id: 'q-f15',
    question: 'What index type is used for fast lexical search on tsvector columns?',
    expectedAnswer: 'Generalized Inverted Indexes (GIN) are used for tsvector columns.',
    goldChunkIds: ['fts-c3'],
    type: 'factual',
  },
  {
    id: 'q-f16',
    question: 'What metric does ts_rank use to score matching documents?',
    expectedAnswer: 'ts_rank computes scores based on lexeme frequency (TF), term density, and document length normalization.',
    goldChunkIds: ['fts-c4'],
    type: 'factual',
  },
  {
    id: 'q-f17',
    question: 'How does storing tsvector as a GENERATED ALWAYS STORED column benefit search queries?',
    expectedAnswer: 'It avoids runtime parsing overhead and ensures the GIN index updates automatically during inserts/updates without triggers.',
    goldChunkIds: ['fts-c5'],
    type: 'factual',
  },
  {
    id: 'q-f18',
    question: 'How does PostgreSQL Row-Level Security enforce multi-tenant isolation?',
    expectedAnswer: 'RLS policies evaluate tenant_id against a transaction setting, automatically filtering rows at the engine level even if application queries omit WHERE clauses.',
    goldChunkIds: ['sec-c1'],
    type: 'factual',
  },
  {
    id: 'q-f19',
    question: 'Why is set_config with is_local=true required when using PgBouncer?',
    expectedAnswer: 'Because PgBouncer in transaction pooling mode reuses connections; is_local=true ensures session settings revert upon transaction completion.',
    goldChunkIds: ['sec-c2'],
    type: 'factual',
  },
  {
    id: 'q-f20',
    question: 'What hashing algorithm and memory cost are used for password storage?',
    expectedAnswer: 'Argon2id with a memory cost of 64MB (65536 KiB), 3 iterations, and 4 threads.',
    goldChunkIds: ['sec-c3'],
    type: 'factual',
  },
  {
    id: 'q-f21',
    question: 'What is the lifespan of JWT access tokens in DocSage?',
    expectedAnswer: 'Access tokens have a short lifespan of 15 minutes.',
    goldChunkIds: ['sec-c4'],
    type: 'factual',
  },
  {
    id: 'q-f22',
    question: 'How are refresh tokens delivered and protected against theft?',
    expectedAnswer: 'They are stored as SHA-256 hashes in PostgreSQL and transmitted exclusively in httpOnly, secure, SameSite cookies.',
    goldChunkIds: ['sec-c4'],
    type: 'factual',
  },
  {
    id: 'q-f23',
    question: 'Why does the application database user lack UPDATE and DELETE permissions on audit_log?',
    expectedAnswer: 'To guarantee an immutable, tamper-proof audit trail for regulatory and compliance assurance.',
    goldChunkIds: ['sec-c5'],
    type: 'factual',
  },
  {
    id: 'q-f24',
    question: 'What candidate beam search width is used at layer 0 in HNSW?',
    expectedAnswer: 'The search width is controlled by parameter efSearch.',
    goldChunkIds: ['hnsw-c2'],
    type: 'factual',
  },
  {
    id: 'q-f25',
    question: 'What property ensures that if two Raft logs have an entry with identical index and term, they are identical up to that index?',
    expectedAnswer: 'The Log Matching Property maintains this invariant.',
    goldChunkIds: ['raft-c4'],
    type: 'factual',
  },

  // ── 15 Multi-Hop Questions ────────────────────────────────────────────────
  {
    id: 'q-m01',
    question: 'How do election timeouts relate to majority quorum voting when electing a leader in Raft?',
    expectedAnswer: 'When a follower experiences an election timeout (150ms-300ms), it transitions to candidate, votes for itself, and requires votes from a majority quorum to win the election.',
    goldChunkIds: ['raft-c1', 'raft-c2'],
    type: 'multi-hop',
  },
  {
    id: 'q-m02',
    question: 'How does client command execution in Raft lead to maintaining identical logs across cluster servers?',
    expectedAnswer: 'The leader appends client commands to its log and sends AppendEntries RPCs; through the Log Matching Property, matching index and term guarantees all preceding entries are identical.',
    goldChunkIds: ['raft-c3', 'raft-c4'],
    type: 'multi-hop',
  },
  {
    id: 'q-m03',
    question: 'How does HNSW graph navigation progress from upper skip-list layers down to the final vector ranking at layer 0?',
    expectedAnswer: 'Navigation begins at the entry point of the sparsest top layer using greedy routing down each layer, until layer 0 where an efSearch beam search finds the nearest neighbors.',
    goldChunkIds: ['hnsw-c1', 'hnsw-c2'],
    type: 'multi-hop',
  },
  {
    id: 'q-m04',
    question: 'How does parameter m affect HNSW graph construction and dynamic search recall?',
    expectedAnswer: 'Parameter m sets the maximum links per node, while efConstruction governs candidate pool size during indexing; higher values increase memory but improve recall.',
    goldChunkIds: ['hnsw-c2', 'hnsw-c3'],
    type: 'multi-hop',
  },
  {
    id: 'q-m05',
    question: 'Why does incremental HNSW indexing with vector_cosine_ops eliminate the re-indexing maintenance required by IVFFlat?',
    expectedAnswer: 'HNSW nodes are linked dynamically at insertion time using cosine distance without requiring global Voronoi centroid training, so vectors can be inserted without periodic rebuilds.',
    goldChunkIds: ['hnsw-c4', 'hnsw-c5'],
    type: 'multi-hop',
  },
  {
    id: 'q-m06',
    question: 'How does raw text normalization in tsvector enable fast Boolean intersections using GIN indexes?',
    expectedAnswer: 'Raw text is normalized into distinct stemmed lexemes in tsvector, and GIN indexes map each lexeme to tuple IDs, enabling multi-word searches via bitmap AND operations.',
    goldChunkIds: ['fts-c1', 'fts-c3'],
    type: 'multi-hop',
  },
  {
    id: 'q-m07',
    question: 'How does websearch_to_tsquery parsing feed into ts_rank scoring for natural user queries?',
    expectedAnswer: 'websearch_to_tsquery converts natural query syntax into valid tsquery expressions, which ts_rank scores against document tsvector based on term frequency and density.',
    goldChunkIds: ['fts-c2', 'fts-c4'],
    type: 'multi-hop',
  },
  {
    id: 'q-m08',
    question: 'How does storing tsvector as a GENERATED column streamline GIN index synchronization during document updates?',
    expectedAnswer: 'Because tsvector is GENERATED ALWAYS STORED, PostgreSQL automatically updates the lexemes and the corresponding GIN index posting lists in the same transaction.',
    goldChunkIds: ['fts-c3', 'fts-c5'],
    type: 'multi-hop',
  },
  {
    id: 'q-m09',
    question: 'How does Row-Level Security combine with transaction-local set_config to prevent cross-tenant data leaks in PgBouncer?',
    expectedAnswer: 'RLS policies evaluate app.tenant_id, and setting it via set_config with is_local=true ensures the configuration vanishes on commit, preventing leakage across pooled PgBouncer connections.',
    goldChunkIds: ['sec-c1', 'sec-c2'],
    type: 'multi-hop',
  },
  {
    id: 'q-m10',
    question: 'How do short-lived JWT access tokens and rotating refresh cookies provide both high performance and fast revocation?',
    expectedAnswer: '15-minute JWT access tokens enable stateless verification without database roundtrips, while 7-day refresh tokens stored as hashes in PostgreSQL allow immediate revocation upon rotation or logout.',
    goldChunkIds: ['sec-c4'],
    type: 'multi-hop',
  },
  {
    id: 'q-m11',
    question: 'How does Argon2id password verification protect against both online brute-force and side-channel cache attacks?',
    expectedAnswer: 'Argon2id combines data-independent memory access (protecting against cache timing attacks) and data-dependent access with 64MB memory cost (resisting GPU brute force).',
    goldChunkIds: ['sec-c3'],
    type: 'multi-hop',
  },
  {
    id: 'q-m12',
    question: 'How does an append-only audit log preserve accountability alongside RLS tenant isolation?',
    expectedAnswer: 'Actions are recorded in audit_log with actor and tenant identifiers, and absence of UPDATE/DELETE privileges prevents attackers or tenants from modifying previous activity records.',
    goldChunkIds: ['sec-c1', 'sec-c5'],
    type: 'multi-hop',
  },
  {
    id: 'q-m13',
    question: 'How do joint consensus transitions in Raft prevent split-brain during configuration changes?',
    expectedAnswer: 'Joint consensus requires decisions to be approved by majorities of both the old and new configurations simultaneously, preventing separate uncoordinated majorities.',
    goldChunkIds: ['raft-c2', 'raft-c5'],
    type: 'multi-hop',
  },
  {
    id: 'q-m14',
    question: 'How does cosine distance in pgvector relate to Euclidean distance when operating on normalized vectors?',
    expectedAnswer: 'For normalized unit vectors, cosine distance (1 - cosine_similarity) is a monotonic transformation of squared Euclidean distance.',
    goldChunkIds: ['hnsw-c4'],
    type: 'multi-hop',
  },
  {
    id: 'q-m15',
    question: 'How does greedy routing in HNSW compare to skip-list search efficiency in traditional 1D data structures?',
    expectedAnswer: 'Greedy routing across sparse upper layers bypasses vast geometric distances similarly to high-level express lanes in 1D skip-lists, achieving O(log N) search time.',
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
    question: 'What PostgreSQL function parses search queries with support for quotes and minus operators without throwing syntax errors?',
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
    question: 'What hashing algorithm is used to hash refresh tokens before storing in the database?',
    expectedAnswer: 'SHA-256',
    goldChunkIds: ['sec-c4'],
    type: 'keyword-exact',
  },

  // ── 10 Unanswerable Questions (Negative Controls) ─────────────────────────
  {
    id: 'q-u01',
    question: 'What is the standard first-line daily therapeutic dosage of Metformin for adult Type 2 diabetes management?',
    expectedAnswer: 'I do not have sufficient information in the provided documents to answer this question.',
    goldChunkIds: [],
    type: 'unanswerable',
  },
  {
    id: 'q-u02',
    question: 'How does the CRISPR-Cas9 single guide RNA complex direct double-strand DNA cleavage?',
    expectedAnswer: 'I do not have sufficient information in the provided documents to answer this question.',
    goldChunkIds: [],
    type: 'unanswerable',
  },
  {
    id: 'q-u03',
    question: 'What is the escape velocity required to leave the gravitational surface of Jupiter?',
    expectedAnswer: 'I do not have sufficient information in the provided documents to answer this question.',
    goldChunkIds: [],
    type: 'unanswerable',
  },
  {
    id: 'q-u04',
    question: 'Which Roman emperor moved the imperial capital to Constantinople in 330 AD?',
    expectedAnswer: 'I do not have sufficient information in the provided documents to answer this question.',
    goldChunkIds: [],
    type: 'unanswerable',
  },
  {
    id: 'q-u05',
    question: 'What is the molecular orbital symmetry of a concerted thermal Diels-Alder pericyclic reaction?',
    expectedAnswer: 'I do not have sufficient information in the provided documents to answer this question.',
    goldChunkIds: [],
    type: 'unanswerable',
  },
  {
    id: 'q-u06',
    question: 'What is the Chandrasekhar mass limit for a stable non-rotating carbon-oxygen white dwarf star?',
    expectedAnswer: 'I do not have sufficient information in the provided documents to answer this question.',
    goldChunkIds: [],
    type: 'unanswerable',
  },
  {
    id: 'q-u07',
    question: 'What seismic velocity discontinuity marks the boundary between the Earth crust and upper mantle?',
    expectedAnswer: 'I do not have sufficient information in the provided documents to answer this question.',
    goldChunkIds: [],
    type: 'unanswerable',
  },
  {
    id: 'q-u08',
    question: 'Who is the narrator of Herman Melville 1851 whaling novel Moby Dick?',
    expectedAnswer: 'I do not have sufficient information in the provided documents to answer this question.',
    goldChunkIds: [],
    type: 'unanswerable',
  },
  {
    id: 'q-u09',
    question: 'What is the Keynesian expenditure multiplier formula when the marginal propensity to consume is 0.8?',
    expectedAnswer: 'I do not have sufficient information in the provided documents to answer this question.',
    goldChunkIds: [],
    type: 'unanswerable',
  },
  {
    id: 'q-u10',
    question: 'What is the physiological function of pulmonary surfactant produced by type II alveolar cells in human lungs?',
    expectedAnswer: 'I do not have sufficient information in the provided documents to answer this question.',
    goldChunkIds: [],
    type: 'unanswerable',
  },
];

// Deterministic 384-dimensional normalized vector generator
function generateDeterministicEmbedding(text: string): number[] {
  const hash = crypto.createHash('sha256').update(text).digest();
  const vec: number[] = [];
  for (let i = 0; i < 384; i++) {
    const byte = hash[i % hash.length] ?? 0;
    vec.push(Number(((byte / 128) - 1).toFixed(4)));
  }
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map((v) => Number((v / (norm || 1)).toFixed(4)));
}

export function writeDatasets(baseDir: string): void {
  const datasetDir = path.join(baseDir, 'dataset');
  const fixturesDir = path.join(baseDir, 'fixtures');

  if (!fs.existsSync(datasetDir)) fs.mkdirSync(datasetDir, { recursive: true });
  if (!fs.existsSync(fixturesDir)) fs.mkdirSync(fixturesDir, { recursive: true });

  // 1. Write corpus
  fs.writeFileSync(path.join(datasetDir, 'corpus.json'), JSON.stringify(CORPUS, null, 2), 'utf-8');

  // 2. Write golden questions as JSONL
  const jsonlContent = GOLDEN_QUESTIONS.map((q) => JSON.stringify(q)).join('\n');
  fs.writeFileSync(path.join(datasetDir, 'golden.jsonl'), jsonlContent, 'utf-8');

  // 3. Precompute embedding fixtures
  const embeddingFixtures: Record<string, number[]> = {};

  for (const chunk of CORPUS) {
    embeddingFixtures[chunk.id] = generateDeterministicEmbedding(chunk.content);
  }

  for (const q of GOLDEN_QUESTIONS) {
    embeddingFixtures[q.id] = generateDeterministicEmbedding(q.question);
  }

  fs.writeFileSync(
    path.join(fixturesDir, 'embeddings.json'),
    JSON.stringify(embeddingFixtures, null, 2),
    'utf-8',
  );

  console.info(`✓ Generated golden dataset: 20 corpus chunks, ${GOLDEN_QUESTIONS.length} evaluation questions.`);
}

// When executed directly:
if (process.argv[1]?.endsWith('generate-dataset.ts') || process.argv[1]?.endsWith('generate-dataset.js')) {
  writeDatasets(path.resolve(import.meta.dirname, '..'));
}
