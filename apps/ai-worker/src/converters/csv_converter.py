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
    """

    category = "tabular"
    MAX_TABLE_ROWS = 35
    MAX_TABLE_COLS = 20

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
            content = raw_bytes.decode(encoding, errors="replace")
            content = content.lstrip("\ufeff")
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
            }

            if (
                len(df) <= self.MAX_TABLE_ROWS
                and len(df.columns) <= self.MAX_TABLE_COLS
            ):
                markdown = self._to_markdown_table(df)
            else:
                markdown = self._to_sentence_format(df)

            markdown = self._post_process(markdown)
            return ProcessorOutput(markdown=markdown, metadata=metadata)

        except Exception as e:
            return ProcessorOutput(markdown="", metadata={"error": str(e)})

    def _detect_encoding(self, raw_bytes: bytes) -> str:
        if raw_bytes.startswith(b"\xef\xbb\xbf"):
            return "utf-8-sig"
        result = chardet.detect(raw_bytes)
        encoding = result.get("encoding", "utf-8")
        return (encoding or "utf-8").lower()

    def _detect_delimiter(self, content: str) -> str:
        try:
            sample = "\n".join(content.split("\n")[:10])
            sniffer = csv.Sniffer()
            dialect = sniffer.sniff(sample, delimiters=",;\t|")
            return dialect.delimiter
        except csv.Error:
            return ","

    def _parse_csv(self, content: str, delimiter: str) -> pd.DataFrame:
        try:
            return pd.read_csv(
                io.StringIO(content),
                delimiter=delimiter,
                dtype=str,
                keep_default_na=False,
            )
        except Exception:
            return pd.DataFrame()

    def _to_markdown_table(self, df: pd.DataFrame) -> str:
        if len(df.columns) == 0:
            return ""
        lines: List[str] = []
        headers = list(df.columns)
        lines.append("| " + " | ".join(str(h) for h in headers) + " |")
        lines.append("| " + " | ".join("---" for _ in headers) + " |")
        for _, row in df.iterrows():
            cells = [str(v).replace("\n", " ").replace("\r", "") for v in row]
            lines.append("| " + " | ".join(cells) + " |")
        return "\n".join(lines)

    def _to_sentence_format(self, df: pd.DataFrame) -> str:
        if df.empty:
            return ""
        lines: List[str] = []
        headers = list(df.columns)
        for _, row in df.iterrows():
            row_lines: List[str] = []
            for header in headers:
                value = str(row[header]).strip()
                if value:
                    value = value.replace("\n", " ").replace("\r", "")
                    row_lines.append(f"**{header}:** {value}")
            if row_lines:
                lines.append("; ".join(row_lines) + ".")
                lines.append("")
        return "\n".join(lines).strip()
