import fs from 'fs';
import path from 'path';

export interface CorpusChunk {
  id: string;
  documentTitle: string;
  section: string;
  page: number;
  content: string;
  tokens: number;
}

// 1. Preserve original 20 baseline chunks so existing golden questions remain 100% valid
const BASELINE_CHUNKS: CorpusChunk[] = [
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
    section: 'Construction Parameters: M and efConstruction',
    page: 2,
    content:
      'The parameter M defines the maximum number of bidirectional connections per element per layer, typically set between 16 and 64. The efConstruction parameter controls the size of the dynamic candidate list during graph building; higher values increase indexing recall at the cost of slower build times.',
    tokens: 51,
  },
  {
    id: 'hnsw-c3',
    documentTitle: 'HNSW Graph Indexing Principles',
    section: 'Search Execution with efSearch',
    page: 3,
    content:
      'During query routing, efSearch controls the priority queue depth when traversing layer 0. Increasing efSearch improves retrieval recall with sub-linear latency trade-offs, enabling high throughput while avoiding full distance scans across the entire corpus.',
    tokens: 44,
  },
  {
    id: 'hnsw-c4',
    documentTitle: 'HNSW Graph Indexing Principles',
    section: 'Memory Footprint and Scaling',
    page: 4,
    content:
      'HNSW graphs maintain connections in memory alongside vector coordinates. For 768-dimensional float32 embeddings, each vector requires approximately 3KB for the raw coordinates plus 1KB to 2KB for neighbor pointer lists depending on M, necessitating RAM-optimized indexing instances.',
    tokens: 45,
  },
  {
    id: 'hnsw-c5',
    documentTitle: 'HNSW Graph Indexing Principles',
    section: 'Comparison with IVFFlat',
    page: 5,
    content:
      'Unlike IVFFlat which relies on coarse quantization centroids and inverted lists, HNSW preserves exact vector coordinates and relies on small-world graph navigation. This achieves significantly higher Recall@k on high-dimensional dense embeddings without requiring periodic index retrain phases.',
    tokens: 48,
  },
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
  {
    id: 'rrf-c1',
    documentTitle: 'Hybrid Retrieval and Rank Fusion',
    section: 'Reciprocal Rank Fusion Formulation',
    page: 1,
    content:
      'Reciprocal Rank Fusion (RRF) scores each document d across retrieval lists using RRF(d) = sum(1 / (k + r_i(d))), where r_i(d) is the 1-based rank of d in retrieval strategy i, and k is a constant parameter conventionally set to 60 to smooth rank disparity.',
    tokens: 52,
  },
  {
    id: 'rrf-c2',
    documentTitle: 'Hybrid Retrieval and Rank Fusion',
    section: 'Combining Dense Vector and Lexical BM25 Search',
    page: 2,
    content:
      'Combining PostgreSQL tsvector full-text search with Gemini dense vector embeddings via RRF mitigates individual failure modes. Lexical search reliably catches exact identifiers, codes, and acronyms, while dense semantic retrieval matches paraphrased concepts and high-level technical intent.',
    tokens: 46,
  },
  {
    id: 'rrf-c3',
    documentTitle: 'Hybrid Retrieval and Rank Fusion',
    section: 'Reranking Pipeline Architecture',
    page: 3,
    content:
      'Following RRF fusion of top-25 lexical and top-25 dense candidates, a listwise reranker evaluates the top-20 merged candidates. The reranker computes fine-grained cross-attention scores between the query and candidate passages, producing the final calibrated top-5 context window.',
    tokens: 48,
  },
  {
    id: 'rrf-c4',
    documentTitle: 'Hybrid Retrieval and Rank Fusion',
    section: 'Confidence Calibration and Abstention',
    page: 4,
    content:
      'When maximum candidate similarity drops below the calibrated relevance threshold (0.58 dense similarity or 0.08 lexical score), the retrieval pipeline abstains from answer generation. This zero-trust boundary prevents model hallucinations on out-of-domain or unanswerable enterprise inquiries.',
    tokens: 45,
  },
  {
    id: 'rrf-c5',
    documentTitle: 'Hybrid Retrieval and Rank Fusion',
    section: 'Latency and Cost Optimization',
    page: 5,
    content:
      'First-stage hybrid retrieval finishes in under 25 milliseconds via indexed PostgreSQL queries. Reranking adds 30ms to 70ms of inference latency, providing an optimal balance between retrieval accuracy (MRR > 0.95) and real-time streaming user experience.',
    tokens: 46,
  },
  {
    id: 'sec-c1',
    documentTitle: 'Multi-Tenant Security and Isolation Architecture',
    section: 'Row-Level Security Enforcement',
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

// 2. Synthetic structured generators for legal public documentation
interface SpecTopic {
  domain: string;
  docTitle: string;
  prefix: string;
  pageStart: number;
  subtopics: Array<{
    section: string;
    themes: string[];
    details: string[];
  }>;
}

const TOPICS: SpecTopic[] = [
  {
    domain: 'Raft Distributed Consensus (Ongaro & Ousterhout Specification)',
    docTitle: 'Raft Consensus Algorithm Specification',
    prefix: 'raft-ext',
    pageStart: 6,
    subtopics: [
      {
        section: 'Leader AppendEntries Consistency Check',
        themes: [
          'When sending an AppendEntries RPC, the leader includes the index and term of the entry immediately preceding the new entries in its log (prevLogIndex, prevLogTerm).',
          'If the follower does not find an entry in its log with the matching index and term, it rejects the new entries.',
          'The consistency check serves as an induction step: the leader log and follower log must match at prevLogIndex for subsequent entries to be safely appended.',
          'If a follower log contains conflicting uncommitted entries with the same index as the new entries, the follower overwrites its conflicting entries.',
        ],
        details: [
          'This inductive log matching invariant prevents committed entries from ever being modified or deleted in any valid Raft state.',
          'Upon rejecting an AppendEntries RPC, the follower sends an error status, causing the leader to decrement nextIndex for that follower and retry.',
          'Optimized rejection recovery allows followers to send the term and first index of the conflicting term, bypassing one-by-one index decrementing.',
        ],
      },
      {
        section: 'Safety Invariants and Election Restriction',
        themes: [
          'Raft guarantees the Leader Completeness Property: if a log entry is committed in a given term, then that entry will be present in the logs of the leaders for all higher-numbered terms.',
          'RequestVote RPC implements the election restriction: a voter denies its vote if its own log is more up-to-date than the candidate log.',
          'Log up-to-dateness is evaluated by comparing the last entry index and term; higher terms are strictly more up-to-date.',
          'If terms of the last entries are equal, whichever log contains the greater length (higher last index) is considered more up-to-date.',
        ],
        details: [
          'Because of this election restriction, log entries never flow from followers to leaders; leaders only append to their logs and push to followers.',
          'Leaders never commit log entries from previous terms by counting replicas; they only commit entries from their current term directly.',
          'Indirect commitment occurs when a current term entry is committed, implicitly committing all preceding entries according to the Log Matching Property.',
        ],
      },
      {
        section: 'Cluster Membership Changes and Joint Consensus',
        themes: [
          'Configuration changes cannot switch directly from old configuration C_old to new configuration C_new because conflicting majorities could elect separate leaders.',
          'Joint consensus entry C_old,new is logged and committed under both C_old and C_new independent majority rules.',
          'Once C_old,new is committed on the leader, the leader logs entry C_new and replicates it across the new cluster configuration.',
          'Servers immediately adopt configuration entries upon appending them to their local logs without waiting for commitment.',
        ],
        details: [
          'During the joint consensus window, an election requires independent majorities from both the original C_old membership and the incoming C_new membership.',
          'Removing servers can cause disturbances if removed servers timeout and send RequestVote RPCs; Raft mitigates this with minimum lease intervals.',
          'Servers not in the active configuration do not count toward majority quorums, but may act as non-voting catchup members before joining.',
        ],
      },
      {
        section: 'Log Compaction and State Snapshotting',
        themes: [
          'Practical systems cannot allow logs to grow without bound; Raft uses memory snapshotting where each server writes its state to persistent disk.',
          'A snapshot includes the state machine data, the lastIncludedIndex, and the lastIncludedTerm of the most recent committed log entry applied.',
          'All log entries up to lastIncludedIndex are discarded from memory and disk once the snapshot file is atomically fsynced.',
          'When a follower lags too far behind the leader discarded log entries, the leader transmits its snapshot using the InstallSnapshot RPC.',
        ],
        details: [
          'InstallSnapshot chunks are sent in sequential byte offsets, and followers assemble them into a staging file before verifying checksums.',
          'Upon receiving a valid InstallSnapshot, the follower discards any existing log entries preceding lastIncludedIndex and resets its state machine.',
          'Snapshotting introduces copy-on-write overhead; implementations fork a background worker to avoid blocking ongoing consensus requests.',
        ],
      },
      {
        section: 'Client Linearizability and Request Deduplication',
        themes: [
          'Clients interact with Raft by sending commands to the leader; if a client contacts a follower, the follower redirects the client to the known leader.',
          'To ensure linearizability, each client assigns a unique monotonic sequence number to every request.',
          'The state machine tracks the latest serial sequence number and response processed for each client identifier.',
          'If the leader receives a duplicate command that was already executed, it immediately returns the cached response without re-executing.',
        ],
        details: [
          'Read-only queries must bypass log replication for high throughput while maintaining linearizability without returning stale data.',
          'A leader verifies its leadership before serving a read-only query by exchanging a round of heartbeat heartbeats with a majority of servers.',
          'Lease read optimizations allow leaders to serve reads locally within an election lease duration, assuming clock drift bounds are honored.',
        ],
      },
    ],
  },
  {
    domain: 'PostgreSQL 16 Enterprise Database Architecture',
    docTitle: 'PostgreSQL 16 Internals and Security Architecture',
    prefix: 'pg-ext',
    pageStart: 6,
    subtopics: [
      {
        section: 'Row Level Security Engine Mechanics',
        themes: [
          'PostgreSQL RLS applies security policies dynamically during query rewrite before physical plan generation.',
          'A permissive policy acts as an OR conjunction with other permissive policies, while restrictive policies act as mandatory AND filters.',
          'FORCE ROW LEVEL SECURITY ensures that the table owner and roles with permissions are subjected to RLS policies identically to untrusted users.',
          'Only superusers and roles granted BYPASSRLS can circumvent RLS policies; multi-tenant production apps must never grant BYPASSRLS.',
        ],
        details: [
          'USING clauses filter existing tuples during SELECT, UPDATE, and DELETE operations.',
          'WITH CHECK clauses validate the new row state during INSERT and UPDATE operations, rejecting invalid rows with an integrity error.',
          'If a query attempts an INSERT on a table with RLS enabled and fails WITH CHECK, PostgreSQL aborts the transaction with error 42501.',
        ],
      },
      {
        section: 'PgBouncer Transaction Pooling Scoping',
        themes: [
          'PgBouncer transaction pooling mode reallocates database backend server processes among client requests between transactions.',
          'Stateful session changes executed via SET persist across connections if not scoped locally, leading to cross-tenant data leakage risks.',
          'SELECT set_config("app.tenant_id", $1, true) sets the configuration parameter locally for the current transaction scope only.',
          'When the transaction commits or rolls back, PostgreSQL automatically resets is_local configuration settings to their default values.',
        ],
        details: [
          'Prepared statements in transaction pooling must either use named transaction-scoped caches or use client-side deallocation.',
          'DISCARD ALL or RESET ALL cannot guarantee tenant isolation if an unhandled error aborts without clearing session variables.',
          'Neon serverless proxy handles PgBouncer pooling by intercepting connection handshakes and dispatching queries to warm compute endpoints.',
        ],
      },
      {
        section: 'Full Text Search tsvector and GIN Inverted Indexes',
        themes: [
          'PostgreSQL full-text search processes raw text into a sorted collection of lexemes stored as a tsvector data type.',
          'The GIN (Generalized Inverted Index) index stores an inverted entry for each lexeme pointing to a bitmap posting list of tuple identifiers (TIDs).',
          'Search queries use tsquery operators: & (AND), | (OR), ! (NOT), and <-> (FOLLOWED BY phrase proximity search).',
          'GIN indexes support fast multi-lexeme lookups because posting lists can be combined via bitwise AND and OR bitmap operations.',
        ],
        details: [
          'The Snowball stemming algorithm reduces inflected words to their root linguistic form, enabling morphological retrieval.',
          'Stopwords defined in the english dictionary (e.g. the, is, at) are stripped during tsvector generation to optimize index storage.',
          'ts_rank and ts_rank_cd calculate lexical relevance based on term frequency and document length normalization factors.',
        ],
      },
      {
        section: 'Concurrency Control and MVCC Tuple Visibility',
        themes: [
          'Multi-Version Concurrency Control (MVCC) in PostgreSQL ensures readers never block writers and writers never block readers.',
          'Each table tuple contains header attributes: xmin (transaction that inserted the row) and xmax (transaction that updated or deleted it).',
          'A transaction visibility snapshot records the active transaction IDs at snapshot creation, determining which tuple versions are visible.',
          'In READ COMMITTED isolation mode, each SQL statement creates a fresh snapshot, whereas REPEATABLE READ holds a single snapshot for the transaction.',
        ],
        details: [
          'Updating a tuple writes a complete new tuple version to disk and updates the xmax of the original tuple to the current transaction ID.',
          'VACUUM processes dead tuples whose xmax is older than the oldest active transaction snapshot, reclaiming dead disk space.',
          'HOT (Heap-Only Tuples) optimization avoids updating index pointers when a tuple is updated within the same 8KB disk page without key changes.',
        ],
      },
      {
        section: 'pgvector Index Architecture: HNSW vs IVFFlat',
        themes: [
          'pgvector extends PostgreSQL with native vector data types and distance operators: <-> (L2), <#> (inner product), and <=> (cosine).',
          'HNSW indexes create hierarchical navigable graphs providing higher Recall@k at low query latencies without requiring retraining.',
          'IVFFlat partitions vector space into Voronoi cells using k-means clustering; queries probe the closest lists specified by probes parameter.',
          'HNSW construction requires tuning m (max connections) and ef_construction (candidate list size), balancing index speed with build time.',
        ],
        details: [
          'Cosine distance in pgvector computes 1 - (A dot B) / (norm(A) * norm(B)); pre-normalizing vectors to unit length enables faster inner product operations.',
          'Iterative index scans in pgvector allow queries combining vector similarity with SQL WHERE filters to retrieve valid matches efficiently.',
          'Memory allocation for HNSW graph traversal is governed by work_mem; insufficient work_mem causes spills to temporary disk buffers.',
        ],
      },
    ],
  },
  {
    domain: 'IETF RFC 8446: The Transport Layer Security (TLS) Protocol Version 1.3',
    docTitle: 'RFC 8446 TLS 1.3 Protocol Specification',
    prefix: 'tls-ext',
    pageStart: 1,
    subtopics: [
      {
        section: 'Handshake State Machine and 1-RTT Negotiation',
        themes: [
          'TLS 1.3 eliminates obsolete cipher suites, renegotiation, and compression, reducing the full handshake latency to 1 round-trip time (1-RTT).',
          'In the ClientHello, the client sends its supported versions, supported cipher suites, and speculative Diffie-Hellman key shares.',
          'The server selects an agreed key share, responds with ServerHello, and immediately transitions into encrypted communication.',
          'All handshake messages following ServerHello, including EncryptedExtensions, Certificate, and CertificateVerify, are fully encrypted.',
        ],
        details: [
          'The client verifies the server certificate using its trust store and verifies the CertificateVerify signature using the server public key.',
          'Both endpoints calculate the Finished message using HMAC over all preceding handshake transcripts to verify integrity.',
          'If the server requires mutual authentication (mTLS), it transmits a CertificateRequest within the encrypted handshake phase.',
        ],
      },
      {
        section: 'Cryptographic Key Schedule and Secret Derivation',
        themes: [
          'TLS 1.3 key derivation is structured around HKDF (HMAC-based Extract-and-Expand Key Derivation Function, RFC 5869).',
          'The key schedule progresses through three phases: Early Secret, Handshake Secret, and Master Secret.',
          'HKDF-Extract combines input keying material with salt, while HKDF-Expand-Label generates specialized traffic keys and nonces.',
          'Traffic keys for application data are derived from client_application_traffic_secret_0 and server_application_traffic_secret_0.',
        ],
        details: [
          'Key updates execute by calling HKDF-Expand-Label on the current traffic secret, providing forward secrecy without renegotiating.',
          'The exporter master secret provides cryptographically isolated keys for application-level protocols such as WebRTC and HTTP/2.',
          'Zero-Round-Trip (0-RTT) early data uses early_traffic_secret derived from pre-shared keys before ServerHello arrives.',
        ],
      },
      {
        section: '0-RTT Early Data and Anti-Replay Mitigation',
        themes: [
          '0-RTT allows clients resuming a connection to transmit application data alongside the initial ClientHello, cutting latency to 0-RTT.',
          'Because 0-RTT data is encrypted under a static pre-shared key secret, it is susceptible to network replay attacks by passive observers.',
          'Servers must strictly restrict 0-RTT to idempotent HTTP requests (e.g. GET queries without side effects) to avoid duplicate execution.',
          'Anti-replay mechanisms include Single-Use Tickets, Client Hello Ticket Age checks, and distributed timestamp sliding windows.',
        ],
        details: [
          'If a server cannot verify freshness of 0-RTT data, it sends an early data rejection, forcing the client to retransmit after 1-RTT.',
          'Early data cannot achieve forward secrecy against an attacker who compromises the pre-shared key at a future date.',
          'Modern HTTP/2 and HTTP/3 implementations mandate client opt-in flags for 0-RTT data paths to safeguard stateful endpoints.',
        ],
      },
      {
        section: 'Record Layer Encryption and AEAD Ciphers',
        themes: [
          'TLS 1.3 mandates Authenticated Encryption with Associated Data (AEAD) algorithms: AES-128-GCM, AES-256-GCM, and ChaCha20-Poly1305.',
          'Static cipher suites and CBC-mode ciphers vulnerable to padding oracle attacks (e.g. Lucky Thirteen) are completely banned.',
          'The TLS record header consists of an opaque content type (always 23 / application_data), protocol version (0x0303), and payload length.',
          'The true content type (handshake, alert, or application data) is placed inside the encrypted payload before AEAD tagging.',
        ],
        details: [
          'Each record is assigned a monotonic 64-bit sequence number that is never transmitted on the wire but XORed into the AEAD nonce.',
          'Record padding allows endpoints to obscure message sizes against traffic analysis attacks by appending variable trailing zeroes.',
          'Maximum plaintext record length is bounded at 2^14 bytes (16384 bytes) to prevent buffer exhaustion and latency amplification.',
        ],
      },
    ],
  },
  {
    domain: 'IETF RFC 7540 & RFC 9113: Hypertext Transfer Protocol Version 2 & 3',
    docTitle: 'RFC 7540 & 9113 HTTP/2 and HTTP/3 Transport Architecture',
    prefix: 'http-ext',
    pageStart: 1,
    subtopics: [
      {
        section: 'Binary Framing Layer and Frame Types',
        themes: [
          'HTTP/2 replaces textual newline-delimited protocol formats with an optimized 9-byte binary framing layer.',
          'Frame headers contain a 24-bit payload length, 8-bit frame type, 8-bit flag field, and 31-bit stream identifier.',
          'Standard frame types include DATA (0x0), HEADERS (0x1), PRIORITY (0x2), RST_STREAM (0x3), SETTINGS (0x4), and GOAWAY (0x7).',
          'Interleaving frames from multiple independent streams across a single TCP connection solves client-side connection limits.',
        ],
        details: [
          'RST_STREAM terminates an individual stream immediately without impacting concurrent streams on the same connection.',
          'The SETTINGS frame negotiates maximum concurrent streams, initial window size, and header table capacity upon connection startup.',
          'PING frames measure round-trip times and verify connection liveness; receivers must echo the payload with the ACK flag set.',
        ],
      },
      {
        section: 'HPACK Header Compression',
        themes: [
          'HTTP/2 utilizes HPACK (RFC 7541) to compress repetitive request and response headers across concurrent streams.',
          'HPACK maintains a static table of 61 pre-defined header name-value pairs and a dynamic FIFO table populated by connection traffic.',
          'Header fields can be represented as indexed integers, literal representations with indexing, or literal representations without indexing.',
          'String literals in HPACK are compressed using a static Huffman code table optimized for HTTP character distribution frequencies.',
        ],
        details: [
          'The dynamic table size is constrained by SETTINGS_HEADER_TABLE_SIZE to prevent denial-of-service memory exhaustion on proxies.',
          'Headers containing sensitive secrets (e.g. Authorization or Cookie) use the "never indexed" flag to prevent CRIME/BREACH compression leakage.',
          'In HTTP/3, HPACK is replaced by QPACK to prevent head-of-line blocking across independent streams on QUIC transport.',
        ],
      },
      {
        section: 'Flow Control and Window Sizing',
        themes: [
          'HTTP/2 implements credit-based flow control on both individual streams and the overall connection.',
          'Flow control applies strictly to DATA frames; control frames (HEADERS, SETTINGS, PING) are exempt from flow control limits.',
          'Both endpoints maintain a flow control window; transmitting a DATA frame decrements the available credit balance.',
          'The WINDOW_UPDATE frame replenishes flow control credits by advertising additional byte capacity to the sender.',
        ],
        details: [
          'The default initial stream flow control window is 65535 octets, which can be altered via SETTINGS_INITIAL_WINDOW_SIZE.',
          'A sender must halt transmission on a stream when the stream flow control window drops to zero or below.',
          'Connection-level flow control prevents a high-volume stream from monopolizing the physical network link.',
        ],
      },
      {
        section: 'HTTP/3 over QUIC: Eliminating Head-of-Line Blocking',
        themes: [
          'While HTTP/2 multiplexes streams over TCP, a single lost TCP packet stalls all multiplexed streams due to TCP in-order delivery.',
          'HTTP/3 runs over QUIC (RFC 9000), a modern UDP-based transport protocol providing independent stream reliability.',
          'Packet loss on one HTTP/3 stream only pauses that individual stream, allowing other concurrent streams to continue processing.',
          'QUIC integrates TLS 1.3 cryptographic negotiation directly into the transport handshake, achieving 1-RTT connection setup.',
        ],
        details: [
          'Connection IDs in QUIC decouple connection state from client IP and port, enabling seamless connection migration across Wi-Fi and cellular.',
          'QPACK accommodates out-of-order stream delivery by separating header block representation from dynamic table instruction streams.',
          'QUIC uses UDP port 443; endpoints discover HTTP/3 capabilities via the Alt-Svc HTTP response header advertisement.',
        ],
      },
    ],
  },
  {
    domain: 'IETF RFC 6749 & RFC 7519: OAuth 2.0 and JSON Web Token (JWT)',
    docTitle: 'RFC 6749 OAuth 2.0 and RFC 7519 JWT Architecture',
    prefix: 'auth-ext',
    pageStart: 1,
    subtopics: [
      {
        section: 'Authorization Code Grant with PKCE',
        themes: [
          'The Authorization Code Grant with Proof Key for Code Exchange (PKCE, RFC 7636) is mandatory for single-page and public applications.',
          'The client creates a high-entropy cryptographic random string called code_verifier and calculates its SHA-256 hash as code_challenge.',
          'The authorization server verifies the code_verifier upon authorization code exchange, mitigating authorization code injection attacks.',
          'The Implicit Grant is formally deprecated because access tokens are exposed in URL fragments and browser history.',
        ],
        details: [
          'State parameters prevent cross-site request forgery (CSRF) attacks by binding the user agent authorization session to the callback.',
          'Redirect URIs must be validated strictly against pre-registered exact string matches to prevent open redirect token exfiltration.',
          'The code_challenge_method must equal S256; the plain method is explicitly rejected for modern zero-trust security postures.',
        ],
      },
      {
        section: 'JWT Cryptographic Claims and Signatures',
        themes: [
          'JSON Web Tokens (JWT, RFC 7519) structure claims into three base64url-encoded parts: Header, Payload, and Cryptographic Signature.',
          'Standard registered claims include iss (issuer), sub (subject identifier), aud (intended audience), exp (expiration timestamp), and jti (JWT ID).',
          'Token signature verification prevents tampering and verifies identity without requiring synchronous database lookups on API gateways.',
          'Asymmetric algorithms (RS256, ES256) allow resource servers to verify tokens using the authorization server public JWKS key set.',
        ],
        details: [
          'The exp claim must be evaluated with strict clock skew tolerances (typically bounded to 60 seconds) to prevent expired token use.',
          'The none algorithm must be explicitly disallowed in token verification libraries to defeat signature bypass vulnerabilities.',
          'Payload claims should remain compact to minimize HTTP header overhead on high-throughput microservice request paths.',
        ],
      },
      {
        section: 'Refresh Token Rotation and Revocation Architecture',
        themes: [
          'Refresh tokens permit clients to obtain fresh short-lived access tokens without forcing end-users to re-authenticate credentials.',
          'Refresh token rotation issues a new refresh token with each refresh request while immediately invalidating the prior token.',
          'If a revoked refresh token is presented, the authorization server detects token reuse and revokes all active family tokens.',
          'Refresh tokens are stored in the database as one-way SHA-256 hashes, preventing token exposure in the event of database leaks.',
        ],
        details: [
          'Refresh token cookies must be marked with httpOnly, secure, and SameSite=Strict/Lax flags to prevent XSS script extraction.',
          'Revocation endpoints (RFC 7009) allow clients to explicitly invalidate refresh tokens upon user logout.',
          'Sliding expiration policies define an absolute maximum lifetime beyond which a refresh token cannot be refreshed.',
        ],
      },
    ],
  },
  {
    domain: 'NIST SP 800-63B: Digital Identity Guidelines',
    docTitle: 'NIST SP 800-63B Authentication and Lifecycle Management',
    prefix: 'nist-ext',
    pageStart: 1,
    subtopics: [
      {
        section: 'Memorized Secret Verifier Standards',
        themes: [
          'NIST SP 800-63B mandates minimum password lengths of at least 8 characters, recommending support for up to 64 characters.',
          'Arbitrary password composition rules (requiring uppercase, lowercase, numbers, and symbols) are deprecated due to poor user outcomes.',
          'Periodic arbitrary password expiration (e.g. forced 90-day password changes) is explicitly prohibited unless compromise is suspected.',
          'Verifiers must screen prospective passwords against lists of compromised, leaked, or commonly used dictionary passwords.',
        ],
        details: [
          'Verifiers must permit users to use password managers by allowing paste operations in all password input fields.',
          'Password hints and knowledge-based authentication questions (e.g. mothers maiden name) are disallowed due to vulnerability to social engineering.',
          'Credential stuffing defense requires rate limiting, CAPTCHA challenges, and IP reputation heuristics on login endpoints.',
        ],
      },
      {
        section: 'Memory-Hard Password Hashing Functions',
        themes: [
          'Verifiers must store passwords using approved salted, memory-hard cryptographic hash functions: Argon2id, scrypt, or PBKDF2.',
          'Argon2id combines Argon2d (data-dependent memory access) and Argon2i (data-independent memory access) to defend against side-channel attacks.',
          'Recommended Argon2id production parameters: minimum memory cost of 64MB (65536 KiB), time cost of 3 iterations, and parallelism of 4.',
          'Each password must use a unique cryptographically secure salt of at least 16 bytes generated by a secure CSPRNG.',
        ],
        details: [
          'GPU-accelerated brute force attacks are deterred because memory-hard functions exhaust GPU memory bandwidth and SRAM cache.',
          'When legacy systems transition from SHA-1 or MD5, passwords should be transparently upgraded to Argon2id upon next successful login.',
          'Pepper secrets stored in hardware security modules (HSM) provide defense-in-depth against offline hash cracking.',
        ],
      },
    ],
  },
  {
    domain: 'Near-Duplicate Distractors (Historical Drafts & Conflicting Models)',
    docTitle: 'Technical Specifications Archive and Superseded Standards',
    prefix: 'distractor-ext',
    pageStart: 1,
    subtopics: [
      {
        section: 'Raft Protocol Draft v0.9 (Superseded Specification)',
        themes: [
          '[DEPRECATED SPECIFICATION] In early Raft Draft v0.9, randomized election timeouts were specified between 100ms and 200ms.',
          '[SUPERSEDED] Draft v0.9 explored single-server cluster transitions without formal joint consensus intermediate states.',
          '[HISTORICAL] Early draft formulations permitted followers to truncate uncommitted entries before receiving leader match confirmations.',
          '[CONFLICTING MODEL] Draft v0.9 lacked the formal Pre-Vote extension, resulting in disruptions when partitioned nodes rejoined.',
        ],
        details: [
          'Modern Raft implementations reject Draft v0.9 timeout values because 100ms-200ms proved too narrow for wide-area broadcast heartbeats.',
          'This archival draft is retained exclusively for comparative distributed consensus research and regression testing.',
          'Do not apply Draft v0.9 configurations in production distributed state machine clusters.',
        ],
      },
      {
        section: 'PostgreSQL 9.4 Legacy Row Security Proposal (Superseded Syntax)',
        themes: [
          '[OBSOLETE SYNTAX] Early PostgreSQL 9.4 development proposals used experimental syntax ALTER TABLE ... ENABLE ROW SECURITY without FORCE.',
          '[DEPRECATED BEHAVIOR] In early design drafts, table owners automatically bypassed row security checks without audit logging.',
          '[SUPERSEDED] Legacy proposals did not distinguish between USING filtering and WITH CHECK insertion constraints.',
          '[CONFLICTING SYNTAX] Preliminary proposals lacked transaction-local set_config scoping, relying on connection-wide variables.',
        ],
        details: [
          'PostgreSQL 16 rejects legacy 9.4 experimental syntax and mandates modern CREATE POLICY and ALTER TABLE ... FORCE ROW LEVEL SECURITY.',
          'Relying on obsolete 9.4 proposals leads to severe multi-tenant data leakage in modern PgBouncer pooled architectures.',
          'Historical documentation entries are maintained for database migration regression benchmarks.',
        ],
      },
      {
        section: 'TLS 1.3 Draft 21 (Pre-Standardization Incompatible Revisions)',
        themes: [
          '[SUPERSEDED DRAFT] TLS 1.3 Draft 21 utilized experimental HKDF label prefixes incompatible with RFC 8446 release standards.',
          '[INCOMPATIBLE CIPHERS] Draft 21 permitted transitional cipher suites that were removed before final publication of RFC 8446.',
          '[ARCHIVAL DRAFT] Handshake transcript hash boundaries differed between Draft 21 and the final RFC 8446 specification.',
          '[DEPRECATED FORMAT] Key share extension identifiers in Draft 21 conflict with standard TLS 1.3 supported group values.',
        ],
        details: [
          'Modern TLS stacks explicitly reject Draft 21 handshakes as malformed protocol negotiation attempts.',
          'Using Draft 21 key schedule derivation algorithms results in MAC verification failure on modern web servers.',
          'This historical artifact is preserved to test protocol discriminator robustness against near-duplicate draft handshakes.',
        ],
      },
      {
        section: 'NIST SP 800-63-2 (Superseded Legacy Identity Guidelines)',
        themes: [
          '[OBSOLETE STANDARD] NIST SP 800-63-2 mandated arbitrary periodic password rotation every 90 days, now formally banned by 800-63B.',
          '[DEPRECATED GUIDANCE] SP 800-63-2 enforced complex composition rules requiring uppercase, lowercase, digits, and special characters.',
          '[DISPROVEN PARADIGM] Studies proved 90-day rotation and composition rules cause predictable user transformations (e.g. Spring2024!).',
          '[SUPERSEDED] Knowledge-based authentication questions (security questions) permitted in 800-63-2 are strictly rejected in 800-63B.',
        ],
        details: [
          'Compliance auditors referencing NIST SP 800-63-2 are non-compliant with modern NIST SP 800-63B Zero Trust security mandates.',
          'Modern identity verification prioritizes password length, breached password screening, and multi-factor FIDO2 passkeys.',
          'Archived for comparative analysis between legacy password policies and modern cryptographic standards.',
        ],
      },
    ],
  },
];

export function buildCorpus(): CorpusChunk[] {
  const corpus: CorpusChunk[] = [...BASELINE_CHUNKS];
  let chunkIndex = 21;

  for (const topic of TOPICS) {
    let page = topic.pageStart;

    for (const sub of topic.subtopics) {
      for (let variation = 0; variation < 20; variation++) {
        for (let i = 0; i < sub.themes.length; i++) {
          const theme = sub.themes[i]!;
          const detail = sub.details[i % sub.details.length]!;

          const chunkId = `${topic.prefix}-c${chunkIndex}`;
          const content = `${theme} In production deployment: ${detail} [Ref: ${topic.docTitle}, Chapter ${page}, Paragraph ${(chunkIndex % 5) + 1}].`;
          const tokens = content.split(/\s+/).length;

          corpus.push({
            id: chunkId,
            documentTitle: topic.docTitle,
            section: `${sub.section} (Part ${(chunkIndex % 8) + 1})`,
            page,
            content,
            tokens,
          });

          chunkIndex++;
          if (chunkIndex % 6 === 0) page++;
        }
      }
    }
  }

  return corpus;
}

// Write to evals/dataset/corpus.json
const corpus = buildCorpus();
const targetDir = path.resolve(process.cwd(), 'evals', 'dataset');
if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

const targetFile = path.join(targetDir, 'corpus.json');
fs.writeFileSync(targetFile, JSON.stringify(corpus, null, 2) + '\n', 'utf-8');

console.info(`✓ Successfully built and wrote ${corpus.length} chunks to ${targetFile}`);
