# apps/ai-worker/src/pptx_processor.py
"""
PPTX Processor for converting PowerPoint files to Markdown.
Uses Docling for conversion with slide markers.
"""

import asyncio
from pathlib import Path
from typing import Any, Dict, Tuple

from src.models import ProcessorOutput
from src.sanitizer import InputSanitizer
from src.normalizer import MarkdownNormalizer
from src.logging_config import get_logger

logger = get_logger(__name__)


class PptxProcessor:
    """
    Processes PPTX files to Markdown format.
    Uses Docling for conversion, adds slide markers.
    """

    def __init__(self):
        self.sanitizer = InputSanitizer()
        self.normalizer = MarkdownNormalizer()
        self._converter = None

    async def process(self, file_path: str) -> ProcessorOutput:
        """
        Process a PPTX file to Markdown.

        Args:
            file_path: Path to the PPTX file

        Returns:
            ProcessorOutput with markdown content and metadata
        """
        try:
            path = Path(file_path)
            if not path.exists():
                return ProcessorOutput(
                    markdown="", metadata={"error": f"File not found: {file_path}"}
                )

            # Convert with Docling
            markdown, slide_count = await self._convert_with_docling(str(path))

            if not markdown or not markdown.strip():
                return ProcessorOutput(markdown="", metadata={}, slide_count=0)

            # Add slide markers between sections
            markdown = self._add_slide_markers(markdown)

            # Sanitize and normalize
            markdown = self.sanitizer.sanitize(markdown)
            markdown = self.normalizer.normalize(markdown)

            # Build metadata
            metadata: Dict[str, Any] = {
                "format": "pptx",
            }

            return ProcessorOutput(
                markdown=markdown, metadata=metadata, slide_count=slide_count
            )

        except Exception as e:
            logger.exception("pptx_processing_error", path=file_path, error=str(e))
            return ProcessorOutput(markdown="", metadata={"error": str(e)})

    async def _convert_with_docling(self, file_path: str) -> Tuple[str, int]:
        """
        Convert PPTX to markdown using Docling.

        Returns:
            Tuple of (markdown_content, slide_count)
        """
        from docling.datamodel.base_models import InputFormat
        from docling.document_converter import DocumentConverter

        if self._converter is None:
            self._converter = DocumentConverter(
                allowed_formats=[InputFormat.PPTX],
            )

        # Run conversion in thread pool
        result = await asyncio.to_thread(self._converter.convert, file_path)

        # Export to markdown
        markdown = result.document.export_to_markdown()

        # Count slides (estimate from pages or sections)
        slide_count = 1
        if hasattr(result.document, "pages"):
            slide_count = len(result.document.pages)
        elif markdown:
            # Count top-level headings as slides
            slide_count = markdown.count("\n# ") + (
                1 if markdown.startswith("# ") else 0
            )

        return markdown, max(1, slide_count)

    def _add_slide_markers(self, markdown: str) -> str:
        """
        Add slide markers between sections.
        Converts double newlines before headings to slide separators.
        """
        if not markdown:
            return markdown

        lines = markdown.split("\n")
        result = []
        prev_blank = False

        for i, line in enumerate(lines):
            # Check if this is a top-level heading after blank lines
            if line.startswith("# ") and prev_blank and result:
                # Replace last blank line with slide marker
                if result and result[-1] == "":
                    result[-1] = "<!-- slide -->"
                    result.append("")

            result.append(line)
            prev_blank = line == ""

        return "\n".join(result)
