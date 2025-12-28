# apps/ai-worker/src/converters/md_converter.py
"""Markdown file converter."""

from pathlib import Path

import chardet

from src.logging_config import get_logger
from src.models import ProcessorOutput

from .base import FormatConverter

logger = get_logger(__name__)


class MarkdownConverter(FormatConverter):
    """
    Converts Markdown files.
    Passes through with encoding detection and sanitization.
    """

    category = "document"

    async def to_markdown(
        self, file_path: str, file_format: str = "md"
    ) -> ProcessorOutput:
        """Convert Markdown file (mostly passthrough with sanitization)."""
        path = Path(file_path)

        if not path.exists():
            logger.error("file_not_found", path=file_path)
            return ProcessorOutput(
                markdown="", metadata={"error": f"File not found: {file_path}"}
            )

        try:
            # 1. Robust reading with encoding detection
            raw_bytes = path.read_bytes()
            encoding = self._detect_encoding(raw_bytes)
            content = raw_bytes.decode(encoding, errors="replace")

            # 2. Sanitize and normalize
            content = self._sanitize_raw(content)
            markdown = self._post_process(content)

            logger.info(
                "md_conversion_complete",
                path=file_path,
                chars=len(markdown),
            )

            return ProcessorOutput(markdown=markdown, metadata={"format": "md"})

        except Exception as e:
            logger.exception("md_conversion_error", path=file_path, error=str(e))
            return ProcessorOutput(markdown="", metadata={"error": str(e)})

    def _detect_encoding(self, raw_bytes: bytes) -> str:
        """Detect file encoding with BOM check."""
        if raw_bytes.startswith(b"\xef\xbb\xbf"):
            return "utf-8-sig"
        result = chardet.detect(raw_bytes)
        encoding = result.get("encoding", "utf-8")
        return (encoding or "utf-8").lower()
