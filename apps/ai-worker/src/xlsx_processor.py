# apps/ai-worker/src/xlsx_processor.py
"""
XLSX Processor for converting Excel files to Markdown.
Uses openpyxl (read_only mode) + pandas for multi-sheet processing.
"""

from pathlib import Path
from typing import Any, Dict, List

import pandas as pd

from src.models import ProcessorOutput
from src.sanitizer import InputSanitizer
from src.normalizer import MarkdownNormalizer
from src.logging_config import get_logger

logger = get_logger(__name__)


class XlsxProcessor:
    """
    Processes XLSX files to Markdown format.
    Multi-sheet support with size-based formatting.
    """

    # Threshold for switching to sentence format
    MAX_TABLE_ROWS = 35
    MAX_TABLE_COLS = 20

    def __init__(self):
        self.sanitizer = InputSanitizer()
        self.normalizer = MarkdownNormalizer()

    async def process(self, file_path: str) -> ProcessorOutput:
        """
        Process an XLSX file to Markdown.

        Args:
            file_path: Path to the XLSX file

        Returns:
            ProcessorOutput with markdown content and metadata
        """
        try:
            path = Path(file_path)
            if not path.exists():
                return ProcessorOutput(
                    markdown="", metadata={"error": f"File not found: {file_path}"}
                )

            # Read all sheets with pandas (uses openpyxl engine)
            try:
                sheets = pd.read_excel(
                    path,
                    sheet_name=None,  # Read all sheets
                    engine="openpyxl",
                    dtype=str,  # Keep all as strings
                    keep_default_na=False,
                )
            except Exception as e:
                return ProcessorOutput(
                    markdown="",
                    metadata={"error": f"Failed to read Excel file: {str(e)}"},
                )

            if not sheets:
                return ProcessorOutput(markdown="", metadata={}, sheet_count=0)

            # Process each sheet
            markdown_parts: List[str] = []
            sheet_count = 0

            for sheet_name, df in sheets.items():
                # Skip empty sheets
                if df.empty or len(df.columns) == 0:
                    continue

                sheet_count += 1
                sheet_md = self._process_sheet(sheet_name, df)
                if sheet_md.strip():
                    markdown_parts.append(sheet_md)

            if not markdown_parts:
                return ProcessorOutput(markdown="", metadata={}, sheet_count=0)

            # Join sheets with separators
            markdown = "\n\n---\n\n".join(markdown_parts)

            # Sanitize and normalize
            markdown = self.sanitizer.sanitize(markdown)
            markdown = self.normalizer.normalize(markdown)

            # Build metadata
            metadata: Dict[str, Any] = {
                "format": "xlsx",
            }

            return ProcessorOutput(
                markdown=markdown, metadata=metadata, sheet_count=sheet_count
            )

        except Exception as e:
            logger.exception("xlsx_processing_error", path=file_path, error=str(e))
            return ProcessorOutput(markdown="", metadata={"error": str(e)})

    def _process_sheet(self, sheet_name: str, df: pd.DataFrame) -> str:
        """Process a single sheet to markdown."""
        lines: List[str] = []

        # Sheet name as H1 heading
        lines.append(f"# {sheet_name}")
        lines.append("")

        # Choose format based on size
        if len(df) <= self.MAX_TABLE_ROWS and len(df.columns) <= self.MAX_TABLE_COLS:
            lines.append(self._to_markdown_table(df))
        else:
            lines.append(self._to_sentence_format(df))

        return "\n".join(lines)

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
            cells = [str(v).replace("\n", " ").replace("\r", "").strip() for v in row]
            row_line = "| " + " | ".join(cells) + " |"
            lines.append(row_line)

        return "\n".join(lines)

    def _to_sentence_format(self, df: pd.DataFrame) -> str:
        """Convert DataFrame to sentence format for large tables."""
        if len(df.columns) == 0:
            return ""

        lines: List[str] = []
        headers = list(df.columns)

        for _, row in df.iterrows():
            row_parts: List[str] = []
            for header in headers:
                value = str(row[header]).strip()
                if value:  # Skip empty values
                    value = value.replace("\n", " ").replace("\r", "")
                    row_parts.append(f"**{header}:** {value}")

            if row_parts:
                lines.append("; ".join(row_parts) + ".")
                lines.append("")  # Blank line between records

        return "\n".join(lines).strip()
