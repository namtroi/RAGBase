# apps/ai-worker/src/processor.py
"""
PDF processor using Docling for document conversion.
Handles OCR detection, chunking, and embedding.
"""

import asyncio
import gc
import time
from pathlib import Path

from .base_processor import BaseProcessor
from .config import settings
from .logging_config import get_logger
from .models import ProcessingResult

logger = get_logger(__name__)


class PDFProcessor(BaseProcessor):
    """PDF processor using Docling for conversion to Markdown."""

    def __init__(self):
        super().__init__()
        self._converters: dict = {}  # Cache converters by OCR mode
        self._semaphore: asyncio.Semaphore | None = None

    def _get_semaphore(self) -> asyncio.Semaphore:
        """Get or create semaphore for limiting concurrent processing."""
        if self._semaphore is None:
            max_workers = max(1, settings.max_workers)
            self._semaphore = asyncio.Semaphore(max_workers)
            logger.info("semaphore_created", max_workers=max_workers)
        return self._semaphore

    def _get_converter(self, ocr_mode: str):
        """Get or create cached Docling converter for the OCR mode."""
        if ocr_mode in self._converters:
            return self._converters[ocr_mode]

        logger.info("creating_converter", ocr_mode=ocr_mode)

        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import PdfPipelineOptions
        from docling.document_converter import DocumentConverter, PdfFormatOption

        pipeline_options = PdfPipelineOptions()

        if ocr_mode == "force" or (ocr_mode == "auto" and settings.ocr_enabled):
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

        pdf_format_option = PdfFormatOption(pipeline_options=pipeline_options)

        converter = DocumentConverter(
            allowed_formats=[InputFormat.PDF],
            format_options={InputFormat.PDF: pdf_format_option},
        )

        self._converters[ocr_mode] = converter
        logger.info("converter_cached", ocr_mode=ocr_mode)

        return converter

    async def process(
        self,
        file_path: str,
        ocr_mode: str = "auto",
        **kwargs,  # Accept extra kwargs like document_id/format but ignore logic-wise here
    ) -> ProcessingResult:
        """Process PDF file and return markdown."""
        async with self._get_semaphore():
            return await self._process_internal(file_path, ocr_mode)

    async def _process_internal(
        self,
        file_path: str,
        ocr_mode: str = "auto",
    ) -> ProcessingResult:
        """Internal processing logic, called within semaphore context."""
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
            if self._is_password_protected(path):
                logger.warning("password_protected", path=file_path)
                return ProcessingResult(
                    success=False,
                    error_code="PASSWORD_PROTECTED",
                    error_message="PDF is password protected. Remove password and re-upload.",
                )

            converter = self._get_converter(ocr_mode)

            # Convert PDF
            result = await asyncio.to_thread(converter.convert, str(path))

            ocr_applied = ocr_mode == "force" or (
                ocr_mode == "auto" and self._needs_ocr(result)
            )

            # 1. Get Markdown
            markdown = result.document.export_to_markdown()

            # 2. Chunking & Embedding (Shared Logic)
            chunks = self._chunk_and_embed(markdown)

            page_count = (
                len(result.document.pages) if hasattr(result.document, "pages") else 1
            )
            processing_time_ms = int((time.time() - start_time) * 1000)

            logger.info(
                "processing_complete",
                path=file_path,
                chunks=len(chunks),
                time_ms=processing_time_ms,
            )

            return ProcessingResult(
                success=True,
                processed_content=markdown,
                chunks=chunks,
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

        finally:
            gc.collect()

    def _is_password_protected(self, path: Path) -> bool:
        try:
            import fitz

            with fitz.open(str(path)) as doc:
                return doc.is_encrypted
        except Exception:
            return False

    def _needs_ocr(self, result) -> bool:
        try:
            text = result.document.export_to_markdown()
            pages = result.document.pages if hasattr(result.document, "pages") else []
            chars_per_page = len(text) / max(1, len(pages))
            return chars_per_page < 50
        except Exception:
            return False


# Singleton instance
pdf_processor = PDFProcessor()
