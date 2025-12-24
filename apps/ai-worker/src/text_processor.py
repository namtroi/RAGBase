# apps/ai-worker/src/text_processor.py
"""
Text file processor for Markdown, TXT, and JSON files.
Converts all formats to markdown, then chunks and embeds.
"""

import gc
import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from .chunker import Chunker
from .embedder import Embedder
from .logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class ProcessingResult:
    """Result of text processing operation."""

    success: bool
    processed_content: Optional[str] = None  # Full markdown output
    chunks: Optional[List[Dict[str, Any]]] = field(
        default_factory=list
    )  # Pre-chunked + embedded
    page_count: int = 1  # Text files are single "page"
    ocr_applied: bool = False  # Never for text files
    processing_time_ms: int = 0
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class TextProcessor:
    """Processor for text-based files (MD, TXT, JSON)."""

    def __init__(self):
        self.chunker = Chunker()
        self.embedder = Embedder()

    async def process(
        self,
        file_path: str,
        file_format: str,
        **kwargs,
    ) -> ProcessingResult:
        """Process text file and return markdown + chunks with embeddings."""
        start_time = time.time()
        path = Path(file_path)

        if not path.exists():
            logger.error("file_not_found", path=file_path)
            return ProcessingResult(
                success=False,
                error_code="CORRUPT_FILE",
                error_message=f"File not found: {file_path}",
            )

        try:
            # Read file content
            content = path.read_text(encoding="utf-8")

            # Convert to markdown based on format
            markdown = self._to_markdown(content, file_format, path.name)

            # Chunk the content
            chunks = self.chunker.chunk(markdown)

            # Generate embeddings for chunks
            if chunks:
                texts = [c["content"] for c in chunks]
                embeddings = self.embedder.embed(texts)
                for i, chunk in enumerate(chunks):
                    chunk["embedding"] = embeddings[i]

            processing_time_ms = int((time.time() - start_time) * 1000)

            logger.info(
                "text_processing_complete",
                path=file_path,
                format=file_format,
                chunks=len(chunks),
                time_ms=processing_time_ms,
            )

            return ProcessingResult(
                success=True,
                processed_content=markdown,
                chunks=chunks,
                page_count=1,
                ocr_applied=False,
                processing_time_ms=processing_time_ms,
            )

        except UnicodeDecodeError as e:
            logger.error("encoding_error", path=file_path, error=str(e))
            return ProcessingResult(
                success=False,
                error_code="CORRUPT_FILE",
                error_message=f"File encoding error: {e}",
            )
        except json.JSONDecodeError as e:
            logger.error("json_parse_error", path=file_path, error=str(e))
            return ProcessingResult(
                success=False,
                error_code="CORRUPT_FILE",
                error_message=f"Invalid JSON: {e}",
            )
        except Exception as e:
            logger.exception("text_processing_error", path=file_path, error=str(e))
            return ProcessingResult(
                success=False,
                error_code="INTERNAL_ERROR",
                error_message=str(e),
            )
        finally:
            gc.collect()

    def _to_markdown(self, content: str, file_format: str, filename: str) -> str:
        """Convert content to markdown format."""
        if file_format == "md":
            # Already markdown, return as-is
            return content

        if file_format == "txt":
            # Plain text - add filename as heading
            return f"# {filename}\n\n{content}"

        if file_format == "json":
            # JSON - pretty print in code block
            try:
                parsed = json.loads(content)
                pretty = json.dumps(parsed, indent=2, ensure_ascii=False)
                return f"# {filename}\n\n```json\n{pretty}\n```"
            except json.JSONDecodeError:
                # If invalid JSON, treat as plain text
                return f"# {filename}\n\n```\n{content}\n```"

        # Unknown format - treat as plain text
        return f"# {filename}\n\n{content}"


# Singleton instance
text_processor = TextProcessor()
