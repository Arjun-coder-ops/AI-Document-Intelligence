import type { GoldenQuestion } from '../types.js';

export const FACTUAL_QUESTIONS: GoldenQuestion[] = [
  {
    id: 'q-f01',
    question: 'What triggers a leader election in the Raft consensus algorithm?',
    expectedAnswer:
      'An election is triggered when a follower experiences an election timeout without receiving heartbeats from a leader.',
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
    expectedAnswer:
      'A candidate wins by receiving votes from a strict majority of servers in the cluster for the same term.',
    goldChunkIds: ['raft-c2'],
    type: 'factual',
  },
  {
    id: 'q-f04',
    question: 'How does a Raft leader replicate commands to follower nodes?',
    expectedAnswer:
      'The leader appends the command to its log and issues AppendEntries RPCs in parallel to all other servers.',
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
    expectedAnswer:
      'HNSW structures vectors into a multi-layer proximity graph where upper layers have longer links and sparser connections, and layer 0 contains all vectors.',
    goldChunkIds: ['hnsw-c1'],
    type: 'factual',
  },
  {
    id: 'q-f08',
    question: 'What routing strategy does HNSW use across graph layers?',
    expectedAnswer:
      'HNSW uses greedy routing from the top-layer entry point down to layer 0, followed by a beam search of width efSearch.',
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
    expectedAnswer:
      'Parameter m defines the maximum number of bidirectional outgoing links per node.',
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
    expectedAnswer:
      'No, HNSW is an incremental structure that allows continuous inserts and deletes without centroids training.',
    goldChunkIds: ['hnsw-c5'],
    type: 'factual',
  },
  {
    id: 'q-f13',
    question: 'What is the PostgreSQL tsvector data type?',
    expectedAnswer:
      'tsvector is a sorted list of distinct normalized lexemes with stopwords and punctuation stripped.',
    goldChunkIds: ['fts-c1'],
    type: 'factual',
  },
  {
    id: 'q-f14',
    question: 'How does websearch_to_tsquery handle natural search phrases?',
    expectedAnswer:
      'It parses search queries safely without syntax errors on unclosed quotes, supporting AND, OR, negation with minus, and quoted phrases.',
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
    expectedAnswer:
      'ts_rank computes scores based on lexeme frequency (TF), term density, and document length normalization.',
    goldChunkIds: ['fts-c4'],
    type: 'factual',
  },
  {
    id: 'q-f17',
    question:
      'How does storing tsvector as a GENERATED ALWAYS STORED column benefit search queries?',
    expectedAnswer:
      'It avoids runtime parsing overhead and ensures the GIN index updates automatically during inserts/updates without triggers.',
    goldChunkIds: ['fts-c5'],
    type: 'factual',
  },
  {
    id: 'q-f18',
    question: 'How does PostgreSQL Row-Level Security enforce multi-tenant isolation?',
    expectedAnswer:
      'RLS policies evaluate tenant_id against a transaction setting, automatically filtering rows at the engine level even if application queries omit WHERE clauses.',
    goldChunkIds: ['sec-c1'],
    type: 'factual',
  },
  {
    id: 'q-f19',
    question: 'Why is set_config with is_local=true required when using PgBouncer?',
    expectedAnswer:
      'Because PgBouncer in transaction pooling mode reuses connections; is_local=true ensures session settings revert upon transaction completion.',
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
    expectedAnswer:
      'They are stored as SHA-256 hashes in PostgreSQL and transmitted exclusively in httpOnly, secure, SameSite cookies.',
    goldChunkIds: ['sec-c4'],
    type: 'factual',
  },
  {
    id: 'q-f23',
    question:
      'Why does the application database user lack UPDATE and DELETE permissions on audit_log?',
    expectedAnswer:
      'To guarantee an immutable, tamper-proof audit trail for regulatory and compliance assurance.',
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
    question:
      'What property ensures that if two Raft logs have an entry with identical index and term, they are identical up to that index?',
    expectedAnswer: 'The Log Matching Property maintains this invariant.',
    goldChunkIds: ['raft-c4'],
    type: 'factual',
  },
];
