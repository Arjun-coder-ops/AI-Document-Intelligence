# DocSage — 2-Minute Screen Recording Demo Script

**Target Audience:** Staff / Principal Hiring Committee & Technical Interviewers  
**Target Duration:** Exactly 2 minutes (120 seconds)  
**Setup:** Browser window open at `http://localhost:5173` (or production URL) with DevTools Console closed and clean layout.

---

### [0:00 - 0:20] Hook & Architectural Foundation
- **Screen:** DocSage Authentication Screen (`/auth`).
- **Spoken Narration:**
  > "Hi, I'm presenting **DocSage**, an enterprise multi-tenant document intelligence system.
  > We completely re-architected this from an untestable single-user Python/FAISS prototype into a FAANG-grade PERN and TypeScript distributed system.
  > Let's log in to the Acme Global workspace as an administrator."
- **Action:** Click the "Admin Demo" quick-fill button, then click "Sign In". Instantly lands on `/chat`.

---

### [0:20 - 0:45] Tenant Isolation (PostgreSQL Kernel RLS)
- **Screen:** Navigation sidebar and Document Library (`/documents`).
- **Spoken Narration:**
  > "Multi-tenancy is not an afterthought here—it's enforced at the PostgreSQL kernel level.
  > All database transactions run as an unprivileged `app_user` with `NOBYPASSRLS`. Every request sets a transaction-local `app.tenant_id`. Even if the application omits a WHERE clause, PostgreSQL guarantees Tenant A can never read Tenant B's chunks or vectors.
  > In the Document Library, uploads stream directly to disk using busboy with magic-byte validation and SHA-256 deduplication. An asynchronous `pg-boss` queue processes structure-aware chunking and pgvector HNSW indexing in the background."
- **Action:** Point out the "Acme Global" tenant badge and `admin` role badge in the sidebar; navigate to `/documents` to show the indexed PDF library with status chips (`ready`, `processing`).

---

### [0:45 - 1:20] Streaming Chat, Verified Citations & Upstream Abort
- **Screen:** Streaming Chat Interface (`/chat`).
- **Spoken Narration:**
  > "Now let's ask a complex technical query: *'How does PostgreSQL RLS enforce tenant isolation?'*
  > Watch the streaming response: our hybrid retriever combines dense HNSW vector search and lexical GIN search via Reciprocal Rank Fusion, followed by a Cross-Encoder reranker.
  > Notice the Time-to-First-Token badge: under 100 milliseconds.
  > Every factual claim includes a verified citation chip like `[1]`. Clicking this chip slides out our Evidence Drawer, highlighting the exact source document, page number, and chunk score.
  > If I click 'Stop Generating', an AbortController immediately terminates the upstream Groq LLM socket, saving GPU tokens."
- **Action:**
  1. Click the preset pill: *"How does PostgreSQL RLS enforce tenant isolation?"* and hit Send.
  2. Observe SSE token streaming and stage latency badges (`TTFT: 98ms`, `Total: 221ms`).
  3. Click inline citation tag `[1]`. The right evidence drawer slides out with the exact source chunk.
  4. Type a long prompt and click "Stop" mid-generation to showcase instant cancellation.

---

### [1:20 - 1:45] Relevance Cutoff & Hallucination Prevention
- **Screen:** Chat Interface (`/chat`).
- **Spoken Narration:**
  > "Unlike naive RAG systems that hallucinate when documents lack the answer, DocSage enforces a strict relevance threshold gate.
  > If I ask: *'What was Acme Global's revenue in 1842?'*—a question absent from our documents—our pipeline detects a sub-threshold score and short-circuits before the LLM. It returns an immediate deterministic abstention with zero citations, achieving 100% abstention accuracy on our test suite."
- **Action:** Submit an unanswerable query. Observe instant rejection without LLM generation. Click the thumbs-up button on an accurate answer to show feedback collection.

---

### [1:45 - 2:00] Observability & Gated Golden Evaluation Matrix
- **Screen:** Admin & Analytics Dashboard (`/admin`).
- **Spoken Narration:**
  > "Finally, the Admin Dashboard exposes real-time Prometheus and OpenTelemetry metrics: monthly inference spend against budget, p95 stage latencies computed via PostgreSQL `percentile_cont`, and zero-citation review queries.
  > Crucially, our 65-question golden evaluation matrix shows that hybrid retrieval plus reranking lifted Recall@5 from 0.2455 to 0.9818—a 300% lift with non-overlapping 95% bootstrap confidence intervals.
  > In GitHub Actions CI, regressions below these thresholds automatically fail the build.
  > DocSage is fully open source, tested across 142 tests, and ready for production."
- **Action:** Scroll through the KPI cards, highlight the 65-Question Evaluation Matrix table and the unanswerable query review queue. End with a confident closing.
