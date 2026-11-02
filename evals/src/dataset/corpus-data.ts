import fs from 'fs';
import path from 'path';
import type { CorpusChunk } from '../types.js';

function loadCorpus(): CorpusChunk[] {
  const jsonPath = path.resolve(import.meta.dirname, '../../dataset/corpus.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const raw = fs.readFileSync(jsonPath, 'utf-8');
      const parsed = JSON.parse(raw) as CorpusChunk[];
      if (Array.isArray(parsed) && parsed.length >= 2000) {
        return parsed;
      }
    } catch {
      // Fallback to in-code corpus if file read fails
    }
  }
  return FALLBACK_CORPUS;
}

const FALLBACK_CORPUS: CorpusChunk[] = [
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

export const CORPUS: CorpusChunk[] = loadCorpus();

