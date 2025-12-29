# apps/ai-worker/src/converters/pymupdf_converter.py
"""Fast PDF converter using PyMuPDF4LLM."""

import gc
from pathlib import Path

from src.logging_config import get_logger
from src.models import ProcessorOutput

from .base import FormatConverter

logger = get_logger(__name__)


class PyMuPDFConverter(FormatConverter):
    """
    Fast PDF converter using PyMuPDF4LLM.
    Optimized for speed (~40x faster than Docling).
    Best for text-heavy PDFs without complex tables.
    """

    category = "document"

    async def to_markdown(self, file_path: str) -> ProcessorOutput:
        """Convert PDF to Markdown using PyMuPDF4LLM."""
        path = Path(file_path)

        if not path.exists():
            logger.error("file_not_found", path=file_path)
            return ProcessorOutput(
                markdown="", metadata={"error": f"File not found: {file_path}"}
            )

        try:
            # Check for password protection
            if self._is_password_protected(path):
                logger.warning("password_protected", path=file_path)
                return ProcessorOutput(
                    markdown="",
                    metadata={
                        "error": "PASSWORD_PROTECTED",
                        "message": "PDF is password protected. Remove password and re-upload.",
                    },
                )

            # Import here to avoid loading at startup
            import pymupdf4llm

            # Convert PDF to Markdown
            markdown = pymupdf4llm.to_markdown(str(path))

            # Sanitize and normalize
            markdown = self._sanitize_raw(markdown)
            markdown = self._post_process_pdf(markdown)

            # Get page count
            page_count = self._get_page_count(path)

            logger.info(
                "pymupdf_conversion_complete",
                path=file_path,
                pages=page_count,
                chars=len(markdown),
            )

            return ProcessorOutput(
                markdown=markdown,
                metadata={"converter": "pymupdf4llm"},
                page_count=page_count,
            )

        except Exception as e:
            logger.exception("pymupdf_conversion_error", path=file_path, error=str(e))
            return ProcessorOutput(markdown="", metadata={"error": str(e)})

        finally:
            gc.collect()

    def _is_password_protected(self, path: Path) -> bool:
        """Check if PDF is password protected."""
        try:
            import fitz

            with fitz.open(str(path)) as doc:
                return doc.is_encrypted
        except Exception:
            return False

    def _get_page_count(self, path: Path) -> int:
        """Get the number of pages in the PDF."""
        try:
            import fitz

            with fitz.open(str(path)) as doc:
                return len(doc)
        except Exception:
            return 1
