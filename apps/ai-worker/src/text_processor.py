# apps/ai-worker/src/text_processor.py
"""
Text file processor for Markdown, TXT, and JSON files.
Converts all formats to markdown, then chunks and embeds.
"""

import gc
import json
import time
from pathlib import Path

from .base_processor import BaseProcessor
from .logging_config import get_logger
from .models import ProcessingResult

logger = get_logger(__name__)


class TextProcessor(BaseProcessor):
    """Processor for text-based files (MD, TXT, JSON)."""

    def __init__(self):
        super().__init__()

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

            # Chunking & Embedding (Shared Logic)
            chunks = self._chunk_and_embed(markdown)

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
