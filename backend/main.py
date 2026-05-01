"""
RAG Chatbot — FastAPI Backend
=============================
Endpoints:
  POST /upload          — Upload one or more PDFs
  POST /ask             — Query with streaming SSE response
  POST /compare         — Compare answers with vs without context
  GET  /documents       — List indexed documents
  GET  /stats           — Pipeline statistics
  DELETE /documents/{filename} — Remove a document
  GET  /health          — Health check
"""
import os
import uuid
import asyncio
import json
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field, validator
import aiofiles

from config import settings
from rag_pipeline import rag_pipeline
from utils.logger import logger
from utils.pdf_processor import PDFProcessingError


# ─── App Setup ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="RAG Document Chatbot API",
    description="Upload PDFs and chat with them using Retrieval-Augmented Generation",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(settings.upload_dir, exist_ok=True)
os.makedirs(settings.vector_store_dir, exist_ok=True)


# ─── Request/Response Models ───────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class AskRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    chat_history: List[ChatMessage] = Field(default_factory=list)
    debug: bool = Field(False, description="Include retrieved chunks in response")

    @validator("query")
    def query_not_empty(cls, v):
        if not v.strip():
            raise ValueError("Query cannot be empty or whitespace")
        return v.strip()


class CompareRequest(BaseModel):
    query: str = Field(..., min_length=1)
    chat_history: List[ChatMessage] = Field(default_factory=list)


class UploadResponse(BaseModel):
    success: bool
    results: List[Dict[str, Any]]
    errors: List[Dict[str, str]]


# ─── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    """Health check — used by Docker and load balancers."""
    return {
        "status": "healthy",
        "vector_store_ready": rag_pipeline.vector_store is not None,
        "documents_indexed": len(rag_pipeline.document_registry),
    }


@app.post("/upload", response_model=UploadResponse)
async def upload_pdfs(files: List[UploadFile] = File(...)):
    """
    Upload one or more PDF files for indexing.
    
    - Validates file types and sizes
    - Saves to disk with unique filenames
    - Ingests into FAISS vector store
    - Returns per-file results
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    results = []
    errors = []

    for file in files:
        original_name = file.filename or "unknown.pdf"
        logger.info(f"Receiving upload: {original_name}")

        # ── Validation ──
        if not original_name.lower().endswith(".pdf"):
            errors.append({"filename": original_name, "error": "Only PDF files are accepted"})
            continue

        # Read content to check size
        content = await file.read()
        if len(content) > max_bytes:
            errors.append({
                "filename": original_name,
                "error": f"File exceeds {settings.max_upload_size_mb}MB limit",
            })
            continue

        if len(content) == 0:
            errors.append({"filename": original_name, "error": "File is empty"})
            continue

        # ── Save with unique name to avoid collisions ──
        safe_name = Path(original_name).stem[:50]  # Truncate long names
        unique_name = f"{safe_name}_{uuid.uuid4().hex[:8]}.pdf"
        save_path = os.path.join(settings.upload_dir, unique_name)

        async with aiofiles.open(save_path, "wb") as f:
            await f.write(content)
        logger.info(f"Saved file to: {save_path}")

        # ── Ingest into RAG pipeline ──
        try:
            result = await rag_pipeline.ingest_pdf(save_path)
            results.append({
                "original_filename": original_name,
                "stored_as": unique_name,
                **result,
                "status": "success",
            })
        except PDFProcessingError as e:
            logger.warning(f"PDF processing error for {original_name}: {e}")
            errors.append({"filename": original_name, "error": str(e)})
            # Clean up failed upload
            if os.path.exists(save_path):
                os.remove(save_path)
        except Exception as e:
            logger.exception(f"Unexpected error processing {original_name}")
            errors.append({"filename": original_name, "error": "Unexpected processing error"})
            if os.path.exists(save_path):
                os.remove(save_path)

    if not results and errors:
        raise HTTPException(
            status_code=422,
            detail={"message": "All uploads failed", "errors": errors}
        )

    return UploadResponse(success=len(results) > 0, results=results, errors=errors)


@app.post("/ask")
async def ask_question(request: AskRequest):
    """
    Ask a question against the indexed documents.
    
    Returns a Server-Sent Events stream:
    - {"type": "sources", "data": [...]}  — retrieved document chunks
    - {"type": "token", "data": "..."}    — streamed answer tokens
    - {"type": "debug_chunks", "data": [...]} — only if debug=True
    - {"type": "done", "data": ""}        — stream end
    - {"type": "error", "data": "..."}    — on error
    """
    history = [{"role": m.role, "content": m.content} for m in request.chat_history]

    async def event_generator():
        async for event in rag_pipeline.query_stream(
            query=request.query,
            chat_history=history,
            debug=request.debug,
        ):
            yield f"data: {event}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/compare")
async def compare_answers(request: CompareRequest):
    """
    Evaluation endpoint: returns answers both WITH and WITHOUT document context.
    Useful for measuring RAG improvement over baseline LLM.
    """
    if not rag_pipeline.vector_store:
        raise HTTPException(status_code=400, detail="No documents indexed yet")

    history = [{"role": m.role, "content": m.content} for m in request.chat_history]

    # Run both in parallel
    chunks_task = asyncio.to_thread(rag_pipeline.retrieve_relevant_chunks, request.query)
    no_ctx_task = rag_pipeline.query_without_context(request.query, history)

    chunks_result, no_ctx_answer = await asyncio.gather(chunks_task, no_ctx_task)
    context, sources = rag_pipeline.format_context(chunks_result)

    # Generate with-context answer (non-streaming for comparison)
    from langchain_groq import ChatGroq
    from langchain.schema import HumanMessage, SystemMessage

    llm = ChatGroq(
        model=settings.groq_chat_model,
        groq_api_key=settings.groq_api_key,
        temperature=0.2,
    )
    messages = rag_pipeline._build_prompt(request.query, context, history, with_context=True)
    with_ctx_response = await llm.ainvoke(messages)

    return {
        "query": request.query,
        "with_context": {
            "answer": with_ctx_response.content,
            "sources_used": len(sources),
            "sources": sources,
        },
        "without_context": {
            "answer": no_ctx_answer,
            "sources_used": 0,
        },
        "retrieved_context_preview": context[:500] + "..." if len(context) > 500 else context,
    }


@app.get("/documents")
async def list_documents():
    """List all indexed documents with metadata."""
    docs = rag_pipeline.list_documents()
    return {"documents": docs, "total": len(docs)}


@app.delete("/documents/{filename}")
async def delete_document(filename: str):
    """
    Remove a document from the registry.
    Note: The FAISS index is not rebuilt on deletion (requires restart to fully remove).
    """
    success = rag_pipeline.delete_document(filename)
    if not success:
        raise HTTPException(status_code=404, detail=f"Document '{filename}' not found")
    return {"success": True, "message": f"'{filename}' removed from registry"}


@app.get("/stats")
async def get_stats():
    """Return RAG pipeline statistics and configuration."""
    return rag_pipeline.get_stats()


# ─── Startup / Shutdown ─────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    logger.info("=" * 60)
    logger.info("RAG Chatbot Backend starting up")
    logger.info(f"Upload directory: {os.path.abspath(settings.upload_dir)}")
    logger.info(f"Vector store: {os.path.abspath(settings.vector_store_dir)}")
    logger.info(f"LLM model: {settings.groq_chat_model}")
    logger.info(f"Embedding model: all-MiniLM-L6-v2")
    logger.info(f"Documents indexed: {len(rag_pipeline.document_registry)}")
    logger.info("=" * 60)


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("RAG Chatbot Backend shutting down")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
