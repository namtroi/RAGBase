# apps/ai-worker/src/converters/json_converter.py
"""JSON file converter with tabular detection."""

import json
from pathlib import Path
from typing import Any, Dict, List

import chardet

from src.logging_config import get_logger
from src.models import ProcessorOutput

from .base import FormatConverter

logger = get_logger(__name__)


class JsonConverter(FormatConverter):
    """
    JSON converter with Tabular strategy support.
    Detects arrays of objects and converts to 'Sentence Serialization'
    for optimal RAG retrieval.
    """

    category = "tabular"

    async def to_markdown(
        self, file_path: str, file_format: str = "json"
    ) -> ProcessorOutput:
        """Convert JSON file to Markdown."""
        path = Path(file_path)

        if not path.exists():
            logger.error("file_not_found", path=file_path)
            return ProcessorOutput(
                markdown="", metadata={"error": f"File not found: {file_path}"}
            )

        try:
            # 1. Read with encoding detection
            raw_bytes = path.read_bytes()
            encoding = self._detect_encoding(raw_bytes)
            content = raw_bytes.decode(encoding, errors="replace")
            content = self._sanitize_raw(content)

            # 2. Parse and convert
            markdown = self._json_to_markdown(content, path.name)
            markdown = self._post_process(markdown)

            logger.info(
                "json_conversion_complete",
                path=file_path,
                chars=len(markdown),
            )

            return ProcessorOutput(markdown=markdown, metadata={"format": "json"})

        except Exception as e:
            logger.exception("json_conversion_error", path=file_path, error=str(e))
            return ProcessorOutput(markdown="", metadata={"error": str(e)})

    def _detect_encoding(self, raw_bytes: bytes) -> str:
        """Detect file encoding with BOM check."""
        if raw_bytes.startswith(b"\xef\xbb\xbf"):
            return "utf-8-sig"
        result = chardet.detect(raw_bytes)
        encoding = result.get("encoding", "utf-8")
        return (encoding or "utf-8").lower()

    def _json_to_markdown(self, content: str, filename: str) -> str:
        """Convert JSON content to Markdown."""
        try:
            parsed = json.loads(content)

            # Check if it's tabular (list of objects)
            if self._is_tabular_json(parsed):
                return self._json_array_to_sentences(parsed, filename)

            # Fallback: pretty-print as code block
            pretty = json.dumps(parsed, indent=2, ensure_ascii=False)
            return f"# {filename}\n\n```json\n{pretty}\n```"

        except json.JSONDecodeError:
            # Invalid JSON → treat as text
            return f"# {filename}\n\n```\n{content}\n```"

    def _is_tabular_json(self, data: Any) -> bool:
        """Check if JSON is a list of flat dictionaries (tabular structure)."""
        if not isinstance(data, list) or len(data) == 0:
            return False
        sample_size = min(len(data), 5)
        return all(isinstance(item, dict) for item in data[:sample_size])

    def _json_array_to_sentences(self, data: List[Dict], filename: str) -> str:
        """
        Converts list of dicts to 'Sentence Serialization' format.
        Format: "{Key} is {Value}. {Key} is {Value}."
        """
        lines = [f"# {filename} (Data)"]

        for item in data:
            row_parts = []
            for key, value in item.items():
                if value is None or str(value).strip() == "":
                    continue
                clean_key = str(key).replace("_", " ").title()
                clean_val = str(value).strip().replace("\n", " ")
                row_parts.append(f"{clean_key} is {clean_val}")

            if row_parts:
                lines.append(". ".join(row_parts) + ".")
                lines.append("")

        return "\n".join(lines)
