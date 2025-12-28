# apps/ai-worker/src/converters/csv_converter.py
"""CSV converter - wraps existing CsvProcessor logic."""

import csv
import io
from pathlib import Path
from typing import Any, Dict, List

import chardet
import pandas as pd

from src.logging_config import get_logger
from src.models import ProcessorOutput

from .base import FormatConverter

logger = get_logger(__name__)


class CsvConverter(FormatConverter):
    """
    Converts CSV files to Markdown format.
    Auto-detects encoding and delimiter.
    Uses table format for small datasets, sentence format for large ones.
    Implements Phase 4 Smart Number Formatting.
    """

    category = "tabular"

    def __init__(self, max_table_rows: int = 35, max_table_cols: int = 20):
        """Initialize converter with configurable table size thresholds.

        Args:
            max_table_rows: Max rows before switching to sentence format.
            max_table_cols: Max columns before switching to sentence format.
        """
        self.max_table_rows = max_table_rows
        self.max_table_cols = max_table_cols

    async def to_markdown(self, file_path: str) -> ProcessorOutput:
        """Convert CSV to Markdown."""
        try:
            path = Path(file_path)
            if not path.exists():
                return ProcessorOutput(
                    markdown="", metadata={"error": f"File not found: {file_path}"}
                )

            raw_bytes = path.read_bytes()
            if not raw_bytes:
                return ProcessorOutput(markdown="", metadata={})

            encoding = self._detect_encoding(raw_bytes)
            # Use 'replace' to avoid crashing on bad bytes before sanitization
            content = raw_bytes.decode(encoding, errors="replace")
            content = content.lstrip("\ufeff")

            # Phase 4: Input Sanitization (Delegate to base class if implemented there,
            # otherwise ensures clean input for CSV parser)
            content = self._sanitize_raw(content)

            if not content.strip():
                return ProcessorOutput(markdown="", metadata={})

            delimiter = self._detect_delimiter(content)
            df = self._parse_csv(content, delimiter)

            if df.empty and len(df.columns) == 0:
                return ProcessorOutput(markdown="", metadata={})

            metadata: Dict[str, Any] = {
                "row_count": len(df),
                "column_count": len(df.columns),
                "encoding": encoding,
                "delimiter": delimiter,
                "strategy": "unknown",
            }

            # Phase 4: Decision Logic
            if (
                len(df) <= self.max_table_rows
                and len(df.columns) <= self.max_table_cols
            ):
                metadata["strategy"] = "markdown_table"
                markdown = self._to_markdown_table(df)
            else:
                metadata["strategy"] = "sentence_serialization"
                markdown = self._to_sentence_format(df)

            markdown = self._post_process(markdown)
            return ProcessorOutput(markdown=markdown, metadata=metadata)

        except Exception as e:
            logger.error(f"Error converting CSV {file_path}: {e}")
            return ProcessorOutput(markdown="", metadata={"error": str(e)})

    def _detect_encoding(self, raw_bytes: bytes) -> str:
        if raw_bytes.startswith(b"\xef\xbb\xbf"):
            return "utf-8-sig"
        result = chardet.detect(raw_bytes)
        encoding = result.get("encoding", "utf-8")
        return (encoding or "utf-8").lower()

    def _detect_delimiter(self, content: str) -> str:
        try:
            # Check first few lines only
            sample = "\n".join(content.split("\n")[:10])
            sniffer = csv.Sniffer()
            dialect = sniffer.sniff(sample, delimiters=",;\t|")
            return dialect.delimiter
        except csv.Error:
            return ","

    def _parse_csv(self, content: str, delimiter: str) -> pd.DataFrame:
        try:
            # Keep default na=False to avoid NaN strings, treat everything as object initially
            return pd.read_csv(
                io.StringIO(content),
                delimiter=delimiter,
                dtype=str,
                keep_default_na=False,
            )
        except Exception:
            return pd.DataFrame()

    def _format_smart_value(self, header: str, value: str) -> str:
        """
        Phase 4: Smart Number Formatting.
        Applies semantic formatting based on header keywords and value type.
        """
        header_lower = header.lower()

        # 1. Clean strings
        value = value.strip()
        if not value:
            return ""

        # 2. Try to parse number
        try:
            # Remove existing commas if present to check numeric validity
            clean_val = value.replace(",", "")
            float_val = float(clean_val)
            is_number = True
        except ValueError:
            is_number = False

        if is_number:
            # Currency Detection
            if any(
                k in header_lower
                for k in ["revenue", "price", "cost", "salary", "usd", "amount"]
            ):
                # If not already formatted with currency symbol
                if not value.startswith("$") and not value.startswith("€"):
                    return f"${float_val:,.2f}"

            # Percentage Detection
            if "rate" in header_lower or "percent" in header_lower:
                if float_val < 1.0:  # Assumption: 0.45 -> 45%
                    return f"{float_val:.1%}"
                return f"{float_val}%"

            # Large Numbers (Thousands separator)
            if float_val > 999:
                # Check if it's an ID (usually doesn't need commas)
                if (
                    "id" not in header_lower
                    and "code" not in header_lower
                    and "year" not in header_lower
                ):
                    return (
                        f"{float_val:,.0f}"
                        if float_val.is_integer()
                        else f"{float_val:,.2f}"
                    )

        # Date Detection (basic keywords)
        # Note: Extensive date parsing is complex; assuming standard ISO or simple formats.
        # If specific Excel serial date conversion is needed, it would go here.

        return value

    def _to_markdown_table(self, df: pd.DataFrame) -> str:
        """Render small datasets as standard Markdown tables."""
        if len(df.columns) == 0:
            return ""

        lines: List[str] = []
        headers = list(df.columns)

        # Escape pipes in headers to prevent breaking markdown
        safe_headers = [
            str(h).replace("|", "&#124;").replace("\n", " ") for h in headers
        ]

        lines.append("| " + " | ".join(safe_headers) + " |")
        lines.append("| " + " | ".join("---" for _ in headers) + " |")

        for _, row in df.iterrows():
            cells = []
            for v in row:
                val = str(v).strip()
                # Escape pipes and newlines
                val = val.replace("|", "&#124;").replace("\n", "<br>")
                cells.append(val)
            lines.append("| " + " | ".join(cells) + " |")

        return "\n".join(lines)

    def _to_sentence_format(self, df: pd.DataFrame) -> str:
        """
        Phase 4: Sentence Serialization for large/wide tables.
        Format: "{Header} is {Value}."
        """
        if df.empty:
            return ""

        lines: List[str] = []
        headers = list(df.columns)

        for _, row in df.iterrows():
            row_parts: List[str] = []
            for header in headers:
                raw_val = str(row[header])
                # Skip empty cells as per roadmap
                if not raw_val or raw_val.strip() == "":
                    continue

                # Apply smart formatting
                formatted_val = self._format_smart_value(str(header), raw_val)

                # Phase 4 Syntax: "{Header} is {Value}."
                # Clean header and value for sentence flow
                clean_header = str(header).strip()
                row_parts.append(f"{clean_header} is {formatted_val}")

            if row_parts:
                # Join parts with periods to create distinct statements or semi-colons
                # Roadmap suggested sentence structure. Using period + space.
                # Example: "Name is John. Age is 25."
                lines.append(". ".join(row_parts) + ".")
                lines.append("")  # Empty line between rows for chunking clarity

        return "\n".join(lines).strip()
