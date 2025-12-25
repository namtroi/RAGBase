# apps/ai-worker/src/converters/text_converter.py
"""Text file converter for MD, TXT, and JSON files."""

import json
from pathlib import Path

from src.logging_config import get_logger
from src.models import ProcessorOutput

from .base import FormatConverter

logger = get_logger(__name__)


class TextConverter(FormatConverter):
    """
    Converts text-based files (MD, TXT, JSON) to Markdown.
    """

    category = "document"  # Default, JSON will be handled specially

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
            content = path.read_text(encoding="utf-8")
            markdown = self._to_markdown(content, file_format, path.name)

            logger.info(
                "text_conversion_complete",
                path=file_path,
                format=file_format,
                chars=len(markdown),
            )

            return ProcessorOutput(markdown=markdown, metadata={"format": file_format})

        except UnicodeDecodeError as e:
            logger.error("encoding_error", path=file_path, error=str(e))
            return ProcessorOutput(
                markdown="", metadata={"error": f"File encoding error: {e}"}
            )
        except json.JSONDecodeError as e:
            logger.error("json_parse_error", path=file_path, error=str(e))
            return ProcessorOutput(
                markdown="", metadata={"error": f"Invalid JSON: {e}"}
            )
        except Exception as e:
            logger.exception("text_conversion_error", path=file_path, error=str(e))
            return ProcessorOutput(markdown="", metadata={"error": str(e)})

    def _to_markdown(self, content: str, file_format: str, filename: str) -> str:
        """Convert content to markdown format."""
        if file_format == "md":
            return content

        if file_format == "txt":
            return f"# {filename}\n\n{content}"

        if file_format == "json":
            try:
                parsed = json.loads(content)
                pretty = json.dumps(parsed, indent=2, ensure_ascii=False)
                return f"# {filename}\n\n```json\n{pretty}\n```"
            except json.JSONDecodeError:
                return f"# {filename}\n\n```\n{content}\n```"

        # Unknown format - treat as plain text
        return f"# {filename}\n\n{content}"


class JsonConverter(TextConverter):
    """JSON-specific converter with tabular category."""

    category = "tabular"

    async def to_markdown(
        self, file_path: str, file_format: str = "json"
    ) -> ProcessorOutput:
        return await super().to_markdown(file_path, "json")
