# apps/ai-worker/src/converters/text_converter.py
"""Text file converter for MD, TXT, and JSON files."""

import json
from pathlib import Path
from typing import Any, Dict, List

import chardet

from src.logging_config import get_logger
from src.models import ProcessorOutput

from .base import FormatConverter

logger = get_logger(__name__)


class TextConverter(FormatConverter):
    """
    Converts text-based files (MD, TXT) to Markdown.
    Includes robust encoding detection.
    """

    category = "document"

    async def to_markdown(
        self, file_path: str, file_format: str = "txt"
    ) -> ProcessorOutput:
        """Convert text file to Markdown."""
        path = Path(file_path)

        if not path.exists():
            logger.error("file_not_found", path=file_path)
            return ProcessorOutput(
                markdown="", metadata={"error": f"File not found: {file_path}"}
            )

        try:
            # 1. Robust Reading (Auto-detect encoding)
            raw_bytes = path.read_bytes()
            encoding = self._detect_encoding(raw_bytes)
            content = raw_bytes.decode(encoding, errors="replace")

            content = self._sanitize_raw(content)

            # 2. Convert based on format
            markdown = self._to_markdown(content, file_format, path.name)

            # 3. Final normalization
            markdown = self._post_process(markdown)

            logger.info(
                "text_conversion_complete",
                path=file_path,
                format=file_format,
                chars=len(markdown),
            )

            return ProcessorOutput(markdown=markdown, metadata={"format": file_format})

        except Exception as e:
            logger.exception("text_conversion_error", path=file_path, error=str(e))
            return ProcessorOutput(markdown="", metadata={"error": str(e)})

    def _detect_encoding(self, raw_bytes: bytes) -> str:
        if raw_bytes.startswith(b"\xef\xbb\xbf"):
            return "utf-8-sig"
        result = chardet.detect(raw_bytes)
        encoding = result.get("encoding", "utf-8")
        return (encoding or "utf-8").lower()

    def _to_markdown(self, content: str, file_format: str, filename: str) -> str:
        """Convert content to markdown format."""
        if file_format == "md":
            # Return as-is, trusting the Content Normalizer later
            return content

        # For TXT, add a title to help the Header-based splitter
        return f"# {filename}\n\n{content}"


class JsonConverter(TextConverter):
    """
    JSON-specific converter with Tabular strategy support.
    Phase 4: Detects arrays of objects and converts them to 'Sentence Serialization'
    for optimal RAG retrieval.
    """

    category = "tabular"

    async def to_markdown(
        self, file_path: str, file_format: str = "json"
    ) -> ProcessorOutput:
        # Override to ensure we use specific JSON logic
        return await super().to_markdown(file_path, "json")

    def _to_markdown(self, content: str, file_format: str, filename: str) -> str:
        try:
            parsed = json.loads(content)

            # Phase 4 Strategy: Check if it's a "Table" (List of Objects)
            if self._is_tabular_json(parsed):
                # Convert to Semantic Sentences (Row-based chunking friendly)
                return self._json_array_to_sentences(parsed, filename)

            # Fallback for unstructured JSON (Config files, nested dicts)
            pretty = json.dumps(parsed, indent=2, ensure_ascii=False)
            return f"# {filename}\n\n```json\n{pretty}\n```"

        except json.JSONDecodeError:
            # Fallback for invalid JSON -> Treat as text
            return f"# {filename}\n\n```\n{content}\n```"

    def _is_tabular_json(self, data: Any) -> bool:
        """
        Check if JSON is a list of flat dictionaries (Tabular structure).
        """
        if not isinstance(data, list) or len(data) == 0:
            return False

        # Check first few items to confirm they are dicts
        # (Assuming homogeneity for simplicity)
        sample_size = min(len(data), 5)
        return all(isinstance(item, dict) for item in data[:sample_size])

    def _json_array_to_sentences(self, data: List[Dict], filename: str) -> str:
        """
        Converts a list of dicts to 'Sentence Serialization' format.
        Format: "{Key} is {Value}. {Key} is {Value}."
        """
        lines = []
        # Add file header
        lines.append(f"# {filename} (Data)")

        for item in data:
            row_parts = []
            for key, value in item.items():
                # Skip null/empty values
                if value is None or str(value).strip() == "":
                    continue

                # Simple formatting
                clean_key = str(key).replace("_", " ").title()
                clean_val = str(value).strip().replace("\n", " ")

                row_parts.append(f"{clean_key} is {clean_val}")

            if row_parts:
                # Combine into a single paragraph/line per record
                lines.append(". ".join(row_parts) + ".")
                # Add empty line to separate records (chunks)
                lines.append("")

        return "\n".join(lines)
