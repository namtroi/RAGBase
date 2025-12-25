# apps/ai-worker/src/csv_processor.py
"""
CSV Processor for converting CSV files to Markdown.
Supports auto-detection of encoding and delimiter.
"""

import csv
import io
from pathlib import Path
from typing import Any, Dict, List

import chardet
import pandas as pd

from src.models import ProcessorOutput
from src.sanitizer import InputSanitizer


class CsvProcessor:
    """
    Processes CSV files to Markdown format.
    Auto-detects encoding and delimiter.
    Uses table format for small datasets, sentence format for large ones.
    """

    # Threshold for switching to sentence format
    MAX_TABLE_ROWS = 35
    MAX_TABLE_COLS = 20

    def __init__(self):
        self.sanitizer = InputSanitizer()

    async def process(self, file_path: str) -> ProcessorOutput:
        """
        Process a CSV file to Markdown.

        Args:
            file_path: Path to the CSV file

        Returns:
            ProcessorOutput with markdown content and metadata
        """
        try:
            path = Path(file_path)
            if not path.exists():
                return ProcessorOutput(
                    markdown="", metadata={"error": f"File not found: {file_path}"}
                )

            # Read file bytes for encoding detection
            raw_bytes = path.read_bytes()
            if not raw_bytes:
                return ProcessorOutput(markdown="", metadata={})

            # Detect encoding
            encoding = self._detect_encoding(raw_bytes)

            # Decode content
            content = raw_bytes.decode(encoding, errors="replace")

            # Remove BOM if present
            content = content.lstrip("\ufeff")

            # Sanitize
            content = self.sanitizer.sanitize(content)

            if not content.strip():
                return ProcessorOutput(markdown="", metadata={})

            # Detect delimiter
            delimiter = self._detect_delimiter(content)

            # Parse CSV
            df = self._parse_csv(content, delimiter)

            # Check if we have any data (including just headers)
            if df.empty and len(df.columns) == 0:
                return ProcessorOutput(markdown="", metadata={})

            # Build metadata
            metadata: Dict[str, Any] = {
                "row_count": len(df),
                "column_count": len(df.columns),
                "encoding": encoding,
                "delimiter": delimiter,
            }

            # Convert to markdown based on size
            if (
                len(df) <= self.MAX_TABLE_ROWS
                and len(df.columns) <= self.MAX_TABLE_COLS
            ):
                markdown = self._to_markdown_table(df)
            else:
                markdown = self._to_sentence_format(df)

            return ProcessorOutput(markdown=markdown, metadata=metadata)

        except Exception as e:
            return ProcessorOutput(markdown="", metadata={"error": str(e)})

    def _detect_encoding(self, raw_bytes: bytes) -> str:
        """Detect file encoding using chardet."""
        # Check for BOM first
        if raw_bytes.startswith(b"\xef\xbb\xbf"):
            return "utf-8-sig"

        result = chardet.detect(raw_bytes)
        encoding = result.get("encoding", "utf-8")

        # Fallback to utf-8 if detection fails
        if not encoding:
            encoding = "utf-8"

        return encoding.lower()

    def _detect_delimiter(self, content: str) -> str:
        """Detect CSV delimiter using csv.Sniffer."""
        try:
            # Use first few lines for detection
            sample = "\n".join(content.split("\n")[:10])
            sniffer = csv.Sniffer()
            dialect = sniffer.sniff(sample, delimiters=",;\t|")
            return dialect.delimiter
        except csv.Error:
            # Default to comma
            return ","

    def _parse_csv(self, content: str, delimiter: str) -> pd.DataFrame:
        """Parse CSV content to DataFrame."""
        try:
            df = pd.read_csv(
                io.StringIO(content),
                delimiter=delimiter,
                dtype=str,  # Keep all as strings for consistent handling
                keep_default_na=False,  # Don't convert empty strings to NaN
            )
            return df
        except Exception:
            return pd.DataFrame()

    def _to_markdown_table(self, df: pd.DataFrame) -> str:
        """Convert DataFrame to Markdown table format."""
        if len(df.columns) == 0:
            return ""

        lines: List[str] = []

        # Header row
        headers = list(df.columns)
        header_line = "| " + " | ".join(str(h) for h in headers) + " |"
        lines.append(header_line)

        # Separator row
        separator = "| " + " | ".join("---" for _ in headers) + " |"
        lines.append(separator)

        # Data rows
        for _, row in df.iterrows():
            # Handle multiline content by replacing newlines with space
            cells = [str(v).replace("\n", " ").replace("\r", "") for v in row]
            row_line = "| " + " | ".join(cells) + " |"
            lines.append(row_line)

        return "\n".join(lines)

    def _to_sentence_format(self, df: pd.DataFrame) -> str:
        """Convert DataFrame to sentence format for large tables."""
        if df.empty:
            return ""

        lines: List[str] = []
        headers = list(df.columns)

        for idx, row in df.iterrows():
            row_lines: List[str] = []
            for header in headers:
                value = str(row[header]).strip()
                if value:  # Skip empty values
                    # Clean multiline content
                    value = value.replace("\n", " ").replace("\r", "")
                    row_lines.append(f"**{header}:** {value}")

            if row_lines:
                lines.append("; ".join(row_lines) + ".")
                lines.append("")  # Blank line between records

        return "\n".join(lines).strip()
