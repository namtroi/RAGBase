# apps/ai-worker/src/converters/pptx_converter.py
"""PowerPoint PPTX converter using Docling."""

import asyncio
import gc
import re
from pathlib import Path
from typing import Any, Dict

from src.logging_config import get_logger
from src.models import ProcessorOutput

from .base import FormatConverter

logger = get_logger(__name__)

# Standard slide marker for presentation chunking
SLIDE_MARKER = "<!-- slide -->"


class PptxConverter(FormatConverter):
    """
    Converts PowerPoint PPTX files to Markdown using Docling.
    Phase 4: Adds robust slide markers for chunking strategy.
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

            # 1. Convert with Docling
            converter = self._get_docling_converter()
            result = await asyncio.to_thread(converter.convert, str(path))

            # 2. Extract raw markdown
            raw_markdown = result.document.export_to_markdown()

            # 3. Phase 4: Input Sanitization
            # (Clean up null bytes or weird control chars before processing markers)
            markdown = self._sanitize_raw(raw_markdown)

            # 4. Inject Slide Markers for Chunking
            # We enforce SLIDE_MARKER as the split token for the chunker
            markdown = self._ensure_slide_markers(markdown)

            # 5. Final Normalization (Headings, Whitespace)
            markdown = self._post_process(markdown)

            # 6. Metadata Extraction
            slide_count = markdown.count(SLIDE_MARKER) + 1
            doc_metadata = self._extract_metadata(result.document)

            # Combine internal count with Docling metadata
            doc_metadata["slide_count"] = slide_count
            doc_metadata["source_format"] = "pptx"

            logger.info(
                "pptx_conversion_complete",
                path=file_path,
                slides=slide_count,
            )

            return ProcessorOutput(
                markdown=markdown,
                metadata=doc_metadata,
                slide_count=slide_count,
            )

        except Exception as e:
            logger.exception("pptx_conversion_error", path=file_path, error=str(e))
            return ProcessorOutput(markdown="", metadata={"error": str(e)})

        finally:
            gc.collect()

    def _extract_metadata(self, doc_obj: Any) -> Dict[str, Any]:
        """Extract title/author from Docling document object if available."""
        metadata = {}
        try:
            # Docling might populate description/provenance
            # Adjust based on exact Docling version fields
            if hasattr(doc_obj, "name") and doc_obj.name:
                metadata["title"] = doc_obj.name
        except Exception:
            pass
        return metadata

    def _ensure_slide_markers(self, markdown: str) -> str:
        """
        Ensures slide markers exist between slides.
        Strategy:
        1. Check for standard Markdown horizontal rules '---' (Docling usually puts these).
        2. Fallback to Header heuristic (# Title) if no rules found.
        """
        # If markers already exist, skip
        if SLIDE_MARKER in markdown:
            return markdown

        # Strategy A: Replace Horizontal Rules (---)
        # Docling typically separates pages/slides with ---
        # We look for --- surrounded by newlines
        if re.search(r"\n\s*---\s*\n", markdown):
            return re.sub(r"\n\s*---\s*\n", f"\n\n{SLIDE_MARKER}\n\n", markdown)

        # Strategy B: Fallback to H1 Headers
        # Only if no --- found (e.g., custom template)
        logger.warning(
            "pptx_fallback_marker", msg="No '---' delimiters found, using H1 heuristic"
        )
        lines = markdown.split("\n")
        result: list[str] = []
        first_heading_found = False

        for line in lines:
            # Detect H1 but exclude H2, H3...
            if line.startswith("# ") and not line.startswith("##"):
                if first_heading_found:
                    result.append(f"\n{SLIDE_MARKER}\n")
                first_heading_found = True
            result.append(line)

        return "\n".join(result)
