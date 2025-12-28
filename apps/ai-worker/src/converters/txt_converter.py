# apps/ai-worker/src/converters/txt_converter.py
"""Plain text file converter."""

from pathlib import Path

import chardet

from src.logging_config import get_logger
from src.models import ProcessorOutput

from .base import FormatConverter

logger = get_logger(__name__)


class TxtConverter(FormatConverter):
    """
    Converts plain text files to Markdown.
    Adds title header for better chunking.
    """

    category = "document"

    async def to_markdown(
        self, file_path: str, file_format: str = "txt"
    ) -> ProcessorOutput:
        """Convert TXT file to Markdown with title."""
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

            # 2. Sanitize
            content = self._sanitize_raw(content)

            # 3. Add title header for chunking
            markdown = f"# {path.name}\n\n{content}"
            markdown = self._post_process(markdown)

            logger.info(
                "txt_conversion_complete",
                path=file_path,
                chars=len(markdown),
            )

            return ProcessorOutput(markdown=markdown, metadata={"format": "txt"})

        except Exception as e:
            logger.exception("txt_conversion_error", path=file_path, error=str(e))
            return ProcessorOutput(markdown="", metadata={"error": str(e)})

    def _detect_encoding(self, raw_bytes: bytes) -> str:
        """Detect file encoding with BOM check."""
        if raw_bytes.startswith(b"\xef\xbb\xbf"):
            return "utf-8-sig"
        result = chardet.detect(raw_bytes)
        encoding = result.get("encoding", "utf-8")
        return (encoding or "utf-8").lower()
