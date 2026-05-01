"""
RAG (Retrieval-Augmented Generation) Pipeline

HOW RAG WORKS:
==============
1. INGESTION PHASE:
   - User uploads PDF(s)
   - Text is extracted from each PDF page
   - Text is split into overlapping chunks (e.g., 500 chars with 50-char overlap)
   - Each chunk is converted to a dense vector embedding via OpenAI's embedding model
   - Embeddings + text are stored in a FAISS vector index on disk

2. RETRIEVAL PHASE (at query time):
   - User's question is converted to an embedding vector
   - FAISS performs fast approximate nearest-neighbor search
   - Top-K most semantically similar chunks are retrieved

3. GENERATION PHASE:
   - Retrieved chunks are assembled into a "context" block
   - A prompt is constructed: [system instructions] + [context] + [chat history] + [user question]
   - The full prompt is sent to the LLM (GPT-4o-mini)
   - The LLM generates an answer grounded in the retrieved context
   - Source attribution metadata is returned alongside the answer
"""
import os
import json
import asyncio
from pathlib import Path
from typing import List, Dict, Any, AsyncGenerator, Optional, Tuple

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain_community.vectorstores import FAISS
from langchain.schema import Document, HumanMessage, AIMessage, SystemMessage
from langchain.chains import ConversationalRetrievalChain
from langchain.prompts import ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate
from langchain_core.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

from config import settings
from utils.logger import logger
from utils.pdf_processor import extract_text_from_pdf, PDFProcessingError


# ─── Text Splitter (shared instance) ──────────────────────────────────────────
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=settings.chunk_size,
    chunk_overlap=settings.chunk_overlap,
    separators=["\n\n", "\n", ". ", " ", ""],
    length_function=len,
)


# ─── Embeddings (shared instance) ─────────────────────────────────────────────
embeddings = HuggingFaceEmbeddings(
    model_name="all-MiniLM-L6-v2"
)


class RAGPipeline:
    """
    Manages the full RAG lifecycle:
    - Document ingestion and vector storage
    - Query processing with conversational memory
    - Streaming response generation
    """

    def __init__(self):
        self.vector_store_path = settings.vector_store_dir
        self.vector_store: Optional[FAISS] = None
        self.document_registry: Dict[str, Dict[str, Any]] = {}  # filename -> metadata
        self._load_state()

    # ────────────────────────────────────────────────────────
    # STATE PERSISTENCE
    # ────────────────────────────────────────────────────────

    def _get_registry_path(self) -> str:
        return os.path.join(self.vector_store_path, "registry.json")

    def _load_state(self):
        """Load existing vector store and document registry from disk."""
        os.makedirs(self.vector_store_path, exist_ok=True)
        index_path = os.path.join(self.vector_store_path, "index.faiss")

        if os.path.exists(index_path):
            try:
                self.vector_store = FAISS.load_local(
                    self.vector_store_path,
                    embeddings,
                    allow_dangerous_deserialization=True,
                )
                logger.info(f"Loaded existing FAISS vector store from {self.vector_store_path}")
            except Exception as e:
                logger.error(f"Failed to load vector store: {e}")
                self.vector_store = None

        registry_path = self._get_registry_path()
        if os.path.exists(registry_path):
            with open(registry_path, "r") as f:
                self.document_registry = json.load(f)
            logger.info(f"Loaded document registry: {list(self.document_registry.keys())}")

    def _save_state(self):
        """Persist vector store and registry to disk."""
        if self.vector_store:
            self.vector_store.save_local(self.vector_store_path)
            logger.info("Saved FAISS vector store to disk")

        with open(self._get_registry_path(), "w") as f:
            json.dump(self.document_registry, f, indent=2)

    # ────────────────────────────────────────────────────────
    # INGESTION
    # ────────────────────────────────────────────────────────

    async def ingest_pdf(self, file_path: str) -> Dict[str, Any]:
        """
        Full ingestion pipeline for a single PDF:
        1. Extract text (page by page)
        2. Split into overlapping chunks
        3. Generate embeddings
        4. Upsert into FAISS

        Args:
            file_path: Absolute path to the uploaded PDF

        Returns:
            Ingestion summary dict
        """
        filename = Path(file_path).name
        logger.info(f"Starting ingestion for: {filename}")

        # Step 1: Extract raw text from PDF pages
        raw_documents = await asyncio.to_thread(extract_text_from_pdf, file_path)
        logger.info(f"Extracted {len(raw_documents)} pages from {filename}")

        # Step 2: Split pages into overlapping chunks
        chunks = text_splitter.split_documents(raw_documents)
        logger.info(f"Split into {len(chunks)} chunks (size={settings.chunk_size}, overlap={settings.chunk_overlap})")

        # Enrich chunk metadata
        for i, chunk in enumerate(chunks):
            chunk.metadata["chunk_id"] = i
            chunk.metadata["source"] = filename

        # Step 3: Embed and store in FAISS
        logger.info(f"Generating embeddings for {len(chunks)} chunks...")
        if self.vector_store is None:
            # First-time: create store
            self.vector_store = await asyncio.to_thread(
                FAISS.from_documents, chunks, embeddings
            )
        else:
            # Subsequent uploads: merge into existing store
            new_store = await asyncio.to_thread(
                FAISS.from_documents, chunks, embeddings
            )
            self.vector_store.merge_from(new_store)

        # Step 4: Register document and persist
        self.document_registry[filename] = {
            "file_path": file_path,
            "pages": len(raw_documents),
            "chunks": len(chunks),
            "chunk_size": settings.chunk_size,
            "chunk_overlap": settings.chunk_overlap,
        }
        self._save_state()

        logger.info(f"Successfully ingested '{filename}': {len(chunks)} chunks indexed")
        return {
            "filename": filename,
            "pages_processed": len(raw_documents),
            "chunks_indexed": len(chunks),
        }

    # ────────────────────────────────────────────────────────
    # RETRIEVAL
    # ────────────────────────────────────────────────────────

    def retrieve_relevant_chunks(
        self, query: str, k: Optional[int] = None
    ) -> List[Tuple[Document, float]]:
        """
        Retrieve top-K chunks most semantically similar to the query.

        Args:
            query: User's question
            k: Number of chunks to retrieve (defaults to settings.top_k_results)

        Returns:
            List of (Document, similarity_score) tuples
        """
        if not self.vector_store:
            raise ValueError("No documents have been indexed yet. Please upload PDFs first.")

        k = k or settings.top_k_sources
        results = self.vector_store.similarity_search_with_score(query, k=k)
        logger.debug(f"Retrieved {len(results)} chunks for query: '{query[:60]}...'")
        return results

    def format_context(self, chunks: List[Tuple[Document, float]]) -> Tuple[str, List[Dict]]:
        """
        Format retrieved chunks into a context string and source list.

        Returns:
            (context_string, list_of_source_dicts)
        """
        context_parts = []
        sources = []

        for i, (doc, score) in enumerate(chunks, 1):
            context_parts.append(
                f"[Source {i}: {doc.metadata.get('source', 'Unknown')}, "
                f"Page {doc.metadata.get('page', '?')}]\n{doc.page_content}"
            )
            sources.append({
                "id": i,
                "source": doc.metadata.get("source", "Unknown"),
                "page": doc.metadata.get("page", "?"),
                "chunk_id": doc.metadata.get("chunk_id", "?"),
                "relevance_score": round(float(score), 4),
                "preview": doc.page_content[:200] + ("..." if len(doc.page_content) > 200 else ""),
                "full_text": doc.page_content,
            })

        context = "\n\n---\n\n".join(context_parts)
        return context, sources

    # ────────────────────────────────────────────────────────
    # GENERATION (STREAMING)
    # ────────────────────────────────────────────────────────

    def _build_prompt(
        self,
        query: str,
        context: str,
        chat_history: List[Dict[str, str]],
        with_context: bool = True,
    ) -> List:
        """Construct the full message list for the LLM."""
        if with_context:
            system_content = (
                "You are a precise, helpful document assistant. "
                "Answer the user's question using ONLY the context provided below. "
                "If the answer is not in the context, say so clearly. "
                "Always cite which source/page you're drawing from.\n\n"
                f"CONTEXT:\n{context}"
            )
        else:
            system_content = (
                "You are a knowledgeable assistant. "
                "Answer the user's question using your general knowledge "
                "(no document context is provided for this comparison)."
            )

        messages = [SystemMessage(content=system_content)]

        # Inject conversation history
        for turn in chat_history[-6:]:  # Keep last 6 turns to manage context window
            if turn["role"] == "user":
                messages.append(HumanMessage(content=turn["content"]))
            elif turn["role"] == "assistant":
                messages.append(AIMessage(content=turn["content"]))

        messages.append(HumanMessage(content=query))
        return messages

    async def query_stream(
        self,
        query: str,
        chat_history: List[Dict[str, str]],
        debug: bool = False,
    ) -> AsyncGenerator[str, None]:
        """
        Full RAG query pipeline with streaming output.
        
        Yields server-sent events as JSON strings:
        - {"type": "sources", "data": [...]}  — upfront, before streaming
        - {"type": "token", "data": "..."}    — each streamed token
        - {"type": "done", "data": ""}        — completion signal
        - {"type": "error", "data": "..."}    — on failure

        Args:
            query: User's question
            chat_history: List of {"role": "user"|"assistant", "content": "..."}
            debug: If True, also yield retrieved chunks for inspection
        """
        if not query.strip():
            yield json.dumps({"type": "error", "data": "Query cannot be empty"})
            return

        if not self.vector_store:
            yield json.dumps({"type": "error", "data": "No documents indexed. Please upload PDFs first."})
            return

        try:
            # ── Step 1: Retrieve relevant chunks ──
            logger.info(f"Processing query: '{query[:80]}'")
            chunks = await asyncio.to_thread(self.retrieve_relevant_chunks, query)
            context, sources = self.format_context(chunks)

            # ── Step 2: Yield sources first (client can render immediately) ──
            yield json.dumps({"type": "sources", "data": sources})

            # ── Debug: yield raw chunks if requested ──
            if debug:
                debug_info = [
                    {
                        "chunk_index": i + 1,
                        "source": c["source"],
                        "page": c["page"],
                        "score": c["relevance_score"],
                        "text": c["full_text"],
                    }
                    for i, c in enumerate(sources)
                ]
                yield json.dumps({"type": "debug_chunks", "data": debug_info})

            # ── Step 3: Build prompt with context + history ──
            messages = self._build_prompt(query, context, chat_history, with_context=True)

            # ── Step 4: Stream LLM response token by token ──
            llm = ChatGroq(
                model=settings.groq_chat_model,
                groq_api_key=settings.groq_api_key,
                temperature=0.2,
                streaming=True,
            )

            async for chunk in llm.astream(messages):
                token = chunk.content
                if token:
                    yield json.dumps({"type": "token", "data": token})

            yield json.dumps({"type": "done", "data": ""})
            logger.info("Streaming response completed")

        except ValueError as e:
            logger.warning(f"Query validation error: {e}")
            yield json.dumps({"type": "error", "data": str(e)})
        except Exception as e:
            logger.exception(f"RAG pipeline error: {e}")
            yield json.dumps({"type": "error", "data": f"Internal error: {str(e)}"})

    async def query_without_context(
        self,
        query: str,
        chat_history: List[Dict[str, str]],
    ) -> str:
        """
        Answer query WITHOUT document context (for evaluation/comparison).
        
        Args:
            query: User's question
            chat_history: Conversation history
            
        Returns:
            LLM answer string
        """
        llm = ChatGroq(
            model=settings.groq_chat_model,
            groq_api_key=settings.groq_api_key,
            temperature=0.2,
        )
        messages = self._build_prompt(query, "", chat_history, with_context=False)
        response = await llm.ainvoke(messages)
        return response.content

    # ────────────────────────────────────────────────────────
    # MANAGEMENT
    # ────────────────────────────────────────────────────────

    def list_documents(self) -> List[Dict[str, Any]]:
        """Return metadata for all indexed documents."""
        return [
            {"filename": name, **meta}
            for name, meta in self.document_registry.items()
        ]

    def get_stats(self) -> Dict[str, Any]:
        """Return pipeline statistics."""
        total_chunks = sum(v.get("chunks", 0) for v in self.document_registry.values())
        return {
            "documents_indexed": len(self.document_registry),
            "total_chunks": total_chunks,
            "vector_store_ready": self.vector_store is not None,
            "embedding_model": "all-MiniLM-L6-v2",
            "llm_model": settings.groq_chat_model,
            "chunk_size": settings.chunk_size,
            "chunk_overlap": settings.chunk_overlap,
            "top_k": settings.top_k_sources,
        }

    def delete_document(self, filename: str) -> bool:
        """
        Remove a document from the registry.
        Note: FAISS doesn't support selective deletion easily.
        A full rebuild would be needed for production. This removes from registry only.
        """
        if filename in self.document_registry:
            del self.document_registry[filename]
            self._save_state()
            logger.info(f"Removed '{filename}' from document registry")
            return True
        return False


# Singleton instance
rag_pipeline = RAGPipeline()
