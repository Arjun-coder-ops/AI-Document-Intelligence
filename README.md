# 📚 DocSage — AI Document Intelligence (RAG Chatbot)

A production-ready Retrieval-Augmented Generation (RAG) chatbot that lets you upload PDFs and chat with them intelligently. Built with FastAPI, React, LangChain, OpenAI, and FAISS.

---

## 🏗️ Project Structure

```
rag-chatbot/
├── backend/
│   ├── main.py              # FastAPI app, all endpoints
│   ├── rag_pipeline.py      # Core RAG logic (ingestion, retrieval, generation)
│   ├── config.py            # Pydantic settings (env-based config)
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── logger.py        # Loguru logging setup
│   │   └── pdf_processor.py # PDF extraction & validation
│   ├── uploads/             # Uploaded PDFs (auto-created)
│   ├── vectorstore/         # FAISS index (auto-created)
│   ├── logs/                # Rotating log files (auto-created)
│   └── .env.example         # Environment variable template
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Root component
│   │   ├── main.jsx             # React entry point
│   │   ├── index.css            # Tailwind + custom styles
│   │   ├── components/
│   │   │   ├── Sidebar.jsx      # Collapsible sidebar with tabs
│   │   │   ├── UploadZone.jsx   # Drag-and-drop PDF uploader
│   │   │   ├── DocumentList.jsx # Indexed documents list
│   │   │   ├── ChatMessage.jsx  # Message bubble with sources
│   │   │   ├── ChatInput.jsx    # Textarea + controls
│   │   │   ├── SourceCard.jsx   # Retrieved chunk card
│   │   │   └── CompareModal.jsx # RAG vs baseline comparison
│   │   ├── hooks/
│   │   │   ├── useChat.js       # Streaming chat state management
│   │   │   └── useDocuments.js  # Document upload/list state
│   │   └── utils/
│   │       └── api.js           # All API calls
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── Dockerfile
│   └── nginx.conf
│
├── Dockerfile               # Backend Docker image
├── docker-compose.yml       # Full stack orchestration
├── requirements.txt         # Python dependencies
├── .gitignore
└── README.md
```

---

## ⚙️ How the RAG Pipeline Works

```
INGESTION (once per document)
─────────────────────────────
PDF File
  ↓
[pypdf] Extract text page by page
  ↓
[LangChain RecursiveCharacterTextSplitter]
  Split into 500-char chunks with 50-char overlap
  ↓
[OpenAI text-embedding-3-small]
  Convert each chunk → dense vector (1536 dims)
  ↓
[FAISS IndexFlatL2]
  Store vectors + text on disk


QUERY (every chat message)
──────────────────────────
User Question
  ↓
[OpenAI Embeddings] Embed the question
  ↓
[FAISS] Top-K nearest neighbor search (default k=4)
  ↓
Retrieved Chunks + metadata (source, page, score)
  ↓
[LangChain ChatPromptTemplate]
  System: "Answer only from context below: {context}"
  History: last 6 conversation turns
  Human: {user_question}
  ↓
[OpenAI gpt-4o-mini] Streaming generation
  ↓
Token-by-token SSE stream → React frontend
```

**Why overlapping chunks?** Overlap ensures that sentences near chunk boundaries aren't split across chunks without context, improving retrieval quality.

**Why FAISS?** FAISS (Facebook AI Similarity Search) performs sub-linear approximate nearest-neighbor search in high-dimensional spaces — fast enough for thousands of chunks without a dedicated vector DB server.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 20+
- OpenAI API key

### 1. Clone & set up backend

```bash
cd backend

# Copy and fill in your API key
cp .env.example .env
# Edit .env: set OPENAI_API_KEY=sk-...

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r ../requirements.txt

# Run the server
uvicorn main:app --reload --port 8000
```

Backend is now at: http://localhost:8000  
API docs: http://localhost:8000/docs

### 2. Set up frontend

```bash
cd frontend

npm install
npm run dev
```

Frontend is now at: http://localhost:5173

### 3. Use the app

1. Open http://localhost:5173
2. Drag and drop PDFs into the left sidebar
3. Wait for indexing to complete (shown per-file)
4. Type a question in the chat box
5. See the answer stream in, with source citations below

---

## 🐳 Docker Deployment

### Single command (full stack)

```bash
# Set your API key first
export OPENAI_API_KEY=sk-your-key-here

# Build and start everything
docker-compose up --build -d
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API docs: http://localhost:8000/docs

### Backend only (if you run frontend separately)

```bash
docker build -t rag-backend .
docker run -p 8000:8000 \
  -e OPENAI_API_KEY=sk-your-key \
  -v $(pwd)/data/uploads:/app/uploads \
  -v $(pwd)/data/vectorstore:/app/vectorstore \
  rag-backend
```

---

## 📡 API Reference

### `POST /upload`
Upload one or more PDF files.

**Request:** `multipart/form-data` with `files[]`

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "original_filename": "report.pdf",
      "stored_as": "report_a1b2c3d4.pdf",
      "pages_processed": 12,
      "chunks_indexed": 47,
      "status": "success"
    }
  ],
  "errors": []
}
```

---

### `POST /ask`
Ask a question. Returns Server-Sent Events stream.

**Request:**
```json
{
  "query": "What are the main conclusions?",
  "chat_history": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "debug": false
}
```

**SSE Events:**
```
data: {"type": "sources", "data": [{...source chunks...}]}
data: {"type": "token", "data": "The"}
data: {"type": "token", "data": " main"}
data: {"type": "done", "data": ""}
data: [DONE]
```

---

### `POST /compare`
Compare RAG answer vs LLM-only (no context) answer side by side.

**Request:** `{ "query": "...", "chat_history": [] }`

**Response:**
```json
{
  "query": "...",
  "with_context": {
    "answer": "...",
    "sources_used": 4,
    "sources": [...]
  },
  "without_context": {
    "answer": "..."
  },
  "retrieved_context_preview": "..."
}
```

---

### `GET /documents`
List all indexed documents with metadata.

### `DELETE /documents/{filename}`
Remove a document from the registry.

### `GET /stats`
Pipeline configuration and statistics.

### `GET /health`
Health check endpoint.

---

## 🔧 Configuration

All settings via environment variables (or `.env` file):

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | *required* | Your OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o-mini` | LLM for generation |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model |
| `CHUNK_SIZE` | `500` | Characters per chunk |
| `CHUNK_OVERLAP` | `50` | Overlap between chunks |
| `TOP_K_RESULTS` | `4` | Chunks to retrieve per query |
| `UPLOAD_DIR` | `uploads` | PDF storage path |
| `VECTOR_STORE_DIR` | `vectorstore` | FAISS index path |
| `MAX_UPLOAD_SIZE_MB` | `50` | Max PDF size |
| `CORS_ORIGINS` | `["http://localhost:3000","http://localhost:5173"]` | Allowed origins |

---

## 🔥 Features

| Feature | Details |
|---|---|
| Multi-PDF support | Upload and query across multiple documents simultaneously |
| Streaming responses | Token-by-token SSE streaming |
| Chat memory | Last 6 conversation turns sent to LLM |
| Source attribution | Each answer shows which chunks were retrieved, from which file/page, with relevance scores |
| Debug mode | Toggle in UI to see raw retrieved chunks alongside answers |
| RAG comparison | Side-by-side: answer with vs without document context |
| Persistent index | FAISS index saved to disk, survives server restarts |
| Error handling | Invalid PDFs, empty queries, scanned documents, size limits |
| Structured logging | Loguru — console + rotating file logs |
| Docker-ready | Multi-stage Dockerfile, nginx for frontend, compose for full stack |

---

## 🧪 Evaluation / Debugging

### 1. Debug mode in UI
Click the 🐛 bug icon in the chat input. Each response will include the raw retrieved chunks with their scores.

### 2. Compare endpoint
Use the **Compare** button (top right) to see side-by-side:
- RAG answer (grounded in your PDFs)
- Baseline LLM answer (general knowledge only)

This clearly shows the value added by retrieval.

### 3. API logs
```bash
# Live logs
tail -f backend/logs/rag_app.log

# Or in Docker
docker-compose logs -f backend
```

### 4. Swagger UI
Visit http://localhost:8000/docs and test endpoints directly, including the `/compare` evaluation endpoint.

---

## 🏭 Production Checklist

- [ ] Set `OPENAI_API_KEY` via secrets manager (not plaintext .env)
- [ ] Mount `/app/uploads` and `/app/vectorstore` as persistent volumes
- [ ] Set `CORS_ORIGINS` to your actual frontend domain
- [ ] Add authentication (JWT/OAuth) — not included by default
- [ ] Consider replacing FAISS with Pinecone/Weaviate for multi-node deployments
- [ ] Add rate limiting (e.g., `slowapi`) to `/ask` endpoint
- [ ] Enable HTTPS via nginx or a load balancer
- [ ] Set up log aggregation (e.g., ship `logs/` to Datadog/Loki)

---

## 🤝 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | FastAPI, Python 3.11, Uvicorn |
| RAG Pipeline | LangChain 0.2 |
| LLM & Embeddings | OpenAI (gpt-4o-mini, text-embedding-3-small) |
| Vector Database | FAISS (local, persisted to disk) |
| PDF Processing | pypdf |
| Logging | Loguru |
| Containerization | Docker, nginx, docker-compose |
