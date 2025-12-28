# apps/ai-worker/src/converters/docx_converter.py
"""DOCX converter using Docling."""

import asyncio
import gc
from pathlib import Path

from src.logging_config import get_logger
from src.models import ProcessorOutput

from .base import FormatConverter

logger = get_logger(__name__)


class DocxConverter(FormatConverter):
    """
    Converts DOCX files to Markdown using Docling.
    Separated from PDF processing for cleaner architecture.
    """

    category = "document"

    def __init__(self):
        self._converter = None

    def _get_docling_converter(self):
        """Get or create cached Docling converter for DOCX."""
        if self._converter is not None:
            return self._converter

        logger.info("creating_docx_converter")

        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import (
            AcceleratorDevice,
            AcceleratorOptions,
            PdfPipelineOptions,
        )
        from docling.document_converter import DocumentConverter, PdfFormatOption

        # Use CPU-only for stability
        accelerator_options = AcceleratorOptions(
            num_threads=4,
            device=AcceleratorDevice.CPU,
        )

        pipeline_options = PdfPipelineOptions(
            accelerator_options=accelerator_options,
            do_table_structure=False,
            do_ocr=False,
        )

        pdf_format_option = PdfFormatOption(pipeline_options=pipeline_options)

        self._converter = DocumentConverter(
            allowed_formats=[InputFormat.DOCX],
            format_options={InputFormat.PDF: pdf_format_option},
        )

        logger.info("docx_converter_cached")
        return self._converter

    async def to_markdown(self, file_path: str) -> ProcessorOutput:
        """Convert DOCX to Markdown."""
        path = Path(file_path)

        if not path.exists():
            logger.error("file_not_found", path=file_path)
            return ProcessorOutput(
                markdown="", metadata={"error": f"File not found: {file_path}"}
            )

        try:
            converter = self._get_docling_converter()
            result = await asyncio.to_thread(converter.convert, str(path))

            markdown = result.document.export_to_markdown()
            markdown = self._sanitize_raw(markdown)
            markdown = self._post_process(markdown)

            page_count = (
                len(result.document.pages) if hasattr(result.document, "pages") else 1
            )

            logger.info(
                "docx_conversion_complete",
                path=file_path,
                pages=page_count,
            )

            return ProcessorOutput(
                markdown=markdown,
                metadata={"converter": "docling"},
                page_count=page_count,
            )

        except Exception as e:
            logger.exception("docx_conversion_error", path=file_path, error=str(e))
            return ProcessorOutput(markdown="", metadata={"error": str(e)})

        finally:
            gc.collect()
