# apps/ai-worker/src/converters/pdf_converter.py
"""PDF/DOCX converter using Docling."""

import asyncio
import gc
from pathlib import Path
from typing import Any, Dict

from src.config import settings
from src.logging_config import get_logger
from src.models import ProcessorOutput

from .base import FormatConverter

logger = get_logger(__name__)


class PdfConverter(FormatConverter):
    """
    Converts PDF and DOCX files to Markdown using Docling.
    Supports OCR for scanned documents.
    """

    category = "document"

    def __init__(self):
        self._converters: Dict[str, Any] = {}  # Cache by OCR mode
        self._semaphore: asyncio.Semaphore | None = None

    def _get_semaphore(self) -> asyncio.Semaphore:
        """Get or create semaphore for limiting concurrent processing."""
        if self._semaphore is None:
            max_workers = max(1, settings.max_workers)
            self._semaphore = asyncio.Semaphore(max_workers)
            logger.info("semaphore_created", max_workers=max_workers)
        return self._semaphore

    def _get_docling_converter(self, ocr_mode: str):
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
            allowed_formats=[InputFormat.PDF, InputFormat.DOCX],
            format_options={InputFormat.PDF: pdf_format_option},
        )

        self._converters[ocr_mode] = converter
        logger.info("converter_cached", ocr_mode=ocr_mode)

        return converter

    async def to_markdown(
        self, file_path: str, ocr_mode: str = "auto"
    ) -> ProcessorOutput:
        """Convert PDF/DOCX to Markdown."""
        async with self._get_semaphore():
            return await self._convert_internal(file_path, ocr_mode)

    async def _convert_internal(
        self, file_path: str, ocr_mode: str = "auto"
    ) -> ProcessorOutput:
        """Internal conversion logic."""
        path = Path(file_path)

        if not path.exists():
            logger.error("file_not_found", path=file_path)
            return ProcessorOutput(
                markdown="", metadata={"error": f"File not found: {file_path}"}
            )

        try:
            if self._is_password_protected(path):
                logger.warning("password_protected", path=file_path)
                return ProcessorOutput(
                    markdown="",
                    metadata={
                        "error": "PASSWORD_PROTECTED",
                        "message": "PDF is password protected. Remove password and re-upload.",
                    },
                )

            converter = self._get_docling_converter(ocr_mode)
            result = await asyncio.to_thread(converter.convert, str(path))

            markdown = result.document.export_to_markdown()
            page_count = (
                len(result.document.pages) if hasattr(result.document, "pages") else 1
            )

            ocr_applied = ocr_mode == "force" or (
                ocr_mode == "auto" and self._needs_ocr(result)
            )

            logger.info(
                "pdf_conversion_complete",
                path=file_path,
                pages=page_count,
                ocr=ocr_applied,
            )

            return ProcessorOutput(
                markdown=markdown,
                metadata={"ocr_applied": ocr_applied},
                page_count=page_count,
            )

        except Exception as e:
            logger.exception("pdf_conversion_error", path=file_path, error=str(e))
            return ProcessorOutput(markdown="", metadata={"error": str(e)})

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
