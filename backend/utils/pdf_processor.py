"""
PDF processing utilities.
Handles text extraction, validation, and metadata extraction from PDF files.
"""
import os
from pathlib import Path
from typing import List, Dict, Any

from pypdf import PdfReader
from langchain.schema import Document

from utils.logger import logger


class PDFProcessingError(Exception):
    """Raised when PDF processing fails."""
    pass


def validate_pdf(file_path: str) -> bool:
    """
    Validate that a file is a readable PDF.
    
    Args:
        file_path: Path to the PDF file
        
    Returns:
        True if valid PDF, raises PDFProcessingError otherwise
    """
    try:
        reader = PdfReader(file_path)
        if len(reader.pages) == 0:
            raise PDFProcessingError(f"PDF has no pages: {file_path}")
        return True
    except Exception as e:
        raise PDFProcessingError(f"Invalid or corrupted PDF '{Path(file_path).name}': {str(e)}")


def extract_text_from_pdf(file_path: str) -> List[Document]:
    """
    Extract text from a PDF file, returning one Document per page.
    
    Args:
        file_path: Path to the PDF file
        
    Returns:
        List of LangChain Document objects with page content and metadata
    """
    logger.info(f"Extracting text from PDF: {Path(file_path).name}")
    
    validate_pdf(file_path)
    
    reader = PdfReader(file_path)
    documents = []
    filename = Path(file_path).name

    for page_num, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        text = text.strip()

        if not text:
            logger.warning(f"Page {page_num} of '{filename}' has no extractable text (may be scanned/image-based)")
            continue

        # Each page becomes a Document with rich metadata
        doc = Document(
            page_content=text,
            metadata={
                "source": filename,
                "file_path": file_path,
                "page": page_num,
                "total_pages": len(reader.pages),
            }
        )
        documents.append(doc)

    if not documents:
        raise PDFProcessingError(
            f"No extractable text found in '{filename}'. "
            "The PDF may be scanned or image-based (OCR not supported in this version)."
        )

    logger.info(f"Extracted {len(documents)} pages from '{filename}'")
    return documents


def get_pdf_metadata(file_path: str) -> Dict[str, Any]:
    """
    Extract PDF metadata (author, title, creation date, etc.).
    
    Args:
        file_path: Path to the PDF file
        
    Returns:
        Dictionary of metadata
    """
    try:
        reader = PdfReader(file_path)
        meta = reader.metadata or {}
        return {
            "title": meta.get("/Title", ""),
            "author": meta.get("/Author", ""),
            "subject": meta.get("/Subject", ""),
            "creator": meta.get("/Creator", ""),
            "pages": len(reader.pages),
            "filename": Path(file_path).name,
        }
    except Exception as e:
        logger.warning(f"Could not extract metadata from PDF: {e}")
        return {"filename": Path(file_path).name}
