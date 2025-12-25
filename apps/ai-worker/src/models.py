# apps/ai-worker/src/models.py
"""Shared models for AI Worker."""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


@dataclass
class ProcessingResult:
    """Result of document processing operation."""

    success: bool
    processed_content: Optional[str] = None  # Full markdown output
    chunks: Optional[List[Dict[str, Any]]] = field(
        default_factory=list
    )  # Pre-chunked + embedded
    page_count: int = 0
    ocr_applied: bool = False
    processing_time_ms: int = 0
    error_code: Optional[str] = None
    error_message: Optional[str] = None


@dataclass
class ProcessorOutput:
    """Output from format-specific processors (Phase 4)."""

    markdown: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    page_count: Optional[int] = None
    slide_count: Optional[int] = None
    sheet_count: Optional[int] = None
    chapter_count: Optional[int] = None


# HTTP API Request/Response Models


class ProcessConfig(BaseModel):
    """Configuration for document processing."""

    ocrMode: str = "auto"
    ocrLanguages: List[str] = ["en"]


class ProcessRequest(BaseModel):
    """Request to process a document."""

    documentId: str
    filePath: str
    format: str = "pdf"  # pdf, md, txt, json
    config: Optional[ProcessConfig] = None


class ProcessResponse(BaseModel):
    """Response from document processing."""

    status: str
    documentId: str
    success: bool
    processingTimeMs: Optional[int] = None
    error: Optional[str] = None


class EmbedRequest(BaseModel):
    """Request to generate embeddings."""

    texts: List[str]


class EmbedResponse(BaseModel):
    """Response with generated embeddings."""

    embeddings: List[List[float]]
