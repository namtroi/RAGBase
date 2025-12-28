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
    # Phase 4: Format category
    format_category: Optional[str] = None
    # Phase 5: Detailed processing metrics
    metrics: Optional[Dict[str, Any]] = None


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


class ProfileConfig(BaseModel):
    """Processing profile configuration from database.

    Contains all configurable parameters for the processing pipeline.
    All fields have defaults matching the database schema defaults.
    """

    # Stage 1: Conversion
    conversionTableRows: int = 35
    conversionTableCols: int = 20
    pdfOcrMode: str = "auto"
    pdfOcrLanguages: str = "en"  # Comma-separated: "en,vi"
    pdfNumThreads: int = 4
    pdfTableStructure: bool = False

    # Stage 2: Chunking
    documentChunkSize: int = 1000
    documentChunkOverlap: int = 100
    documentHeaderLevels: int = 3
    presentationMinChunk: int = 200
    tabularRowsPerChunk: int = 20

    # Stage 3: Quality
    qualityMinChars: int = 50
    qualityMaxChars: int = 2000
    qualityPenaltyPerFlag: float = 0.15
    autoFixEnabled: bool = True
    autoFixMaxPasses: int = 2

    @property
    def ocr_languages_list(self) -> List[str]:
        """Parse comma-separated languages to list for OCR libraries."""
        return [
            lang.strip() for lang in self.pdfOcrLanguages.split(",") if lang.strip()
        ]


class ProcessConfig(BaseModel):
    """Configuration for document processing (legacy, kept for compatibility)."""

    ocrMode: str = "auto"
    ocrLanguages: List[str] = ["en"]
    # New: Full profile configuration
    profileConfig: Optional[ProfileConfig] = None


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
