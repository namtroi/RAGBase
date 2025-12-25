# apps/ai-worker/src/converters/pptx_converter.py
"""PowerPoint PPTX converter using Docling."""

import asyncio
import gc
from pathlib import Path

from src.logging_config import get_logger
from src.models import ProcessorOutput

from .base import FormatConverter

logger = get_logger(__name__)


class PptxConverter(FormatConverter):
    """
    Converts PowerPoint PPTX files to Markdown using Docling.
    Adds slide markers for presentation chunking.
    """

    category = "presentation"

    def __init__(self):
        self._converter = None

    def _get_docling_converter(self):
        """Get or create Docling converter for PPTX."""
        if self._converter is not None:
            return self._converter

        from docling.datamodel.base_models import InputFormat
        from docling.document_converter import DocumentConverter

        # Note: PPTX converter in Docling doesn't use TableStructureModel
        # so GPU issues are less likely. But we log for monitoring.
        self._converter = DocumentConverter(allowed_formats=[InputFormat.PPTX])
        logger.info("pptx_converter_created")

        return self._converter

    async def to_markdown(self, file_path: str) -> ProcessorOutput:
        """Convert PPTX to Markdown with slide markers."""
        try:
            path = Path(file_path)
            if not path.exists():
                return ProcessorOutput(
                    markdown="", metadata={"error": f"File not found: {file_path}"}
                )

            converter = self._get_docling_converter()
            result = await asyncio.to_thread(converter.convert, str(path))

            markdown = result.document.export_to_markdown()

            # Add slide markers if not present
            if "<!-- slide -->" not in markdown:
                markdown = self._add_slide_markers(markdown)

            slide_count = markdown.count("<!-- slide -->") + 1

            logger.info(
                "pptx_conversion_complete",
                path=file_path,
                slides=slide_count,
            )

            return ProcessorOutput(
                markdown=markdown,
                metadata={"slide_count": slide_count},
                slide_count=slide_count,
            )

        except Exception as e:
            logger.exception("pptx_conversion_error", path=file_path, error=str(e))
            return ProcessorOutput(markdown="", metadata={"error": str(e)})

        finally:
            gc.collect()

    def _add_slide_markers(self, markdown: str) -> str:
        """Add slide markers between top-level sections."""
        lines = markdown.split("\n")
        result: list[str] = []
        first_heading_found = False

        for line in lines:
            if line.startswith("# ") and not line.startswith("##"):
                if first_heading_found:
                    result.append("\n<!-- slide -->\n")
                first_heading_found = True
            result.append(line)

        return "\n".join(result)
