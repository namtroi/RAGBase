# apps/ai-worker/src/processor.py
"""
PDF processor using Docling for document conversion.
Handles OCR detection and password-protected PDFs.
"""

import asyncio
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from .config import settings
from .logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class ProcessingResult:
    """Result of PDF processing operation."""

    success: bool
    markdown: Optional[str] = None
    page_count: int = 0
    ocr_applied: bool = False
    processing_time_ms: int = 0
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class PDFProcessor:
    """PDF processor using Docling for conversion to Markdown."""

    def __init__(self):
        self._converter = None

    def _get_converter(self, ocr_mode: str):
        """Create Docling converter with appropriate OCR settings."""
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import PdfPipelineOptions
        from docling.document_converter import DocumentConverter, PdfFormatOption

        pipeline_options = PdfPipelineOptions()

        if ocr_mode == "force" or (ocr_mode == "auto" and settings.ocr_enabled):
            # OCR is enabled - configure if easyocr is available
            try:
                from docling.datamodel.pipeline_options import EasyOcrOptions

                languages = settings.ocr_languages.split(",")
                pipeline_options.do_ocr = True
                pipeline_options.ocr_options = EasyOcrOptions(lang=languages)
            except ImportError:
                logger.warning("ocr_not_available", reason="easyocr not installed")
                pipeline_options.do_ocr = False
        else:
            pipeline_options.do_ocr = False

        # Docling 2.15.0 API: wrap pipeline_options in PdfFormatOption
        pdf_format_option = PdfFormatOption(pipeline_options=pipeline_options)

        return DocumentConverter(
            allowed_formats=[InputFormat.PDF],
            format_options={InputFormat.PDF: pdf_format_option},
        )

    async def process(
        self,
        file_path: str,
        ocr_mode: str = "auto",
    ) -> ProcessingResult:
        """Process PDF file and return markdown."""
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
            # Check for password protection
            if self._is_password_protected(path):
                logger.warning("password_protected", path=file_path)
                return ProcessingResult(
                    success=False,
                    error_code="PASSWORD_PROTECTED",
                    error_message="PDF is password protected. Remove password and re-upload.",
                )

            # Get converter with OCR settings
            converter = self._get_converter(ocr_mode)

            # Convert PDF (run in thread pool for async compatibility)
            result = await asyncio.to_thread(converter.convert, str(path))

            # Check if OCR was actually applied
            ocr_applied = ocr_mode == "force" or (
                ocr_mode == "auto" and self._needs_ocr(result)
            )

            # Export to markdown
            markdown = result.document.export_to_markdown()

            # Save markdown to file for quality review
            output_dir = Path("/tmp/markdown_output")
            output_dir.mkdir(exist_ok=True)
            output_file = output_dir / f"{path.stem}.md"
            output_file.write_text(markdown, encoding="utf-8")
            logger.info("markdown_saved", output_path=str(output_file))

            # Get page count
            page_count = (
                len(result.document.pages) if hasattr(result.document, "pages") else 1
            )

            processing_time_ms = int((time.time() - start_time) * 1000)

            logger.info(
                "processing_complete",
                path=file_path,
                page_count=page_count,
                ocr_applied=ocr_applied,
                time_ms=processing_time_ms,
            )

            return ProcessingResult(
                success=True,
                markdown=markdown,
                page_count=page_count,
                ocr_applied=ocr_applied,
                processing_time_ms=processing_time_ms,
            )

        except Exception as e:
            logger.exception("processing_error", path=file_path, error=str(e))

            error_code = "INTERNAL_ERROR"
            if "timeout" in str(e).lower():
                error_code = "TIMEOUT"
            elif "corrupt" in str(e).lower() or "invalid" in str(e).lower():
                error_code = "CORRUPT_FILE"

            return ProcessingResult(
                success=False,
                error_code=error_code,
                error_message=str(e),
            )

    def _is_password_protected(self, path: Path) -> bool:
        """Check if PDF is password protected using PyMuPDF."""
        try:
            import fitz  # PyMuPDF

            doc = fitz.open(str(path))
            is_encrypted = doc.is_encrypted
            doc.close()
            return is_encrypted
        except Exception:
            return False

    def _needs_ocr(self, result) -> bool:
        """Determine if OCR was needed based on text extraction."""
        try:
            # If very little text was extracted, OCR was likely needed
            text = result.document.export_to_markdown()
            pages = result.document.pages if hasattr(result.document, "pages") else []
            # Less than 50 chars per page suggests scanned
            chars_per_page = len(text) / max(1, len(pages))
            return chars_per_page < 50
        except Exception:
            return False


# Singleton instance
pdf_processor = PDFProcessor()
