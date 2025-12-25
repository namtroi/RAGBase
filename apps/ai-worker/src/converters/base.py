# apps/ai-worker/src/converters/base.py
"""Base class for format converters using Strategy Pattern."""

from abc import ABC, abstractmethod
from typing import Literal

from src.models import ProcessorOutput

FormatCategory = Literal["document", "presentation", "tabular"]


class FormatConverter(ABC):
    """
    Abstract base for all format converters.
    Each converter transforms a specific file format to Markdown.
    """

    # Subclasses must define their category
    category: FormatCategory = "document"

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

    async def process(self, file_path: str, *args, **kwargs) -> ProcessorOutput:
        """Backward-compatible alias for to_markdown()."""
        return await self.to_markdown(file_path, *args, **kwargs)
