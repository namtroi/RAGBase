# apps/ai-worker/src/converters/base.py
"""Base class for format converters using Strategy Pattern."""

from abc import ABC, abstractmethod
from typing import Literal

from src.models import ProcessorOutput
from src.normalizer import MarkdownNormalizer
from src.sanitizer import InputSanitizer

FormatCategory = Literal["document", "presentation", "tabular"]


class FormatConverter(ABC):
    """
    Abstract base for all format converters.
    Each converter transforms a specific file format to Markdown.
    """

    # Subclasses must define their category
    category: FormatCategory = "document"

    # Shared instances for text processing
    _sanitizer = InputSanitizer()
    _normalizer = MarkdownNormalizer()

    @abstractmethod
    async def to_markdown(self, file_path: str) -> ProcessorOutput:
        """
        Convert file to Markdown.

        Args:
            file_path: Path to the file to convert.

        Returns:
            ProcessorOutput with markdown content and metadata.
        """
        pass

    def _sanitize_raw(self, text: str) -> str:
        """
        Sanitize raw text before formatting.
        Fixes encoding issues, removes control characters, normalizes Unicode.

        Args:
            text: Raw text content.

        Returns:
            Cleaned text ready for formatting.
        """
        return self._sanitizer.sanitize(text)

    def _post_process(self, markdown: str) -> str:
        """
        Normalize markdown after conversion.
        Standardizes bullets, removes empty sections, fixes code blocks.

        Args:
            markdown: Raw markdown from converter.

        Returns:
            Cleaned and consistent markdown.
        """
        return self._normalizer.normalize(markdown)

    def _post_process_pdf(self, markdown: str) -> str:
        """
        Post-process for PDF: normalize + remove page artifacts + junk code blocks.
        """
        markdown = self._normalizer.normalize(markdown)
        markdown = self._normalizer.remove_page_artifacts(markdown)
        markdown = self._normalizer.remove_junk_code_blocks(markdown)
        return markdown

    def _post_process_pymupdf(self, markdown: str) -> str:
        """
        Post-process for PyMuPDF: includes soft linebreak merge.
        PyMuPDF4LLM preserves PDF hard line breaks more than Docling.
        """
        markdown = self._normalizer.normalize(markdown)
        markdown = self._normalizer.merge_soft_linebreaks(markdown)
        markdown = self._normalizer.remove_page_artifacts(markdown)
        markdown = self._normalizer.remove_junk_code_blocks(markdown)
        return markdown

    async def process(self, file_path: str, *args, **kwargs) -> ProcessorOutput:
        """Backward-compatible alias for to_markdown()."""
        return await self.to_markdown(file_path, *args, **kwargs)
