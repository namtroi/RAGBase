# apps/ai-worker/src/models.py
"""Shared models for AI Worker."""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


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
