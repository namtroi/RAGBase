# apps/ai-worker/src/converters/xlsx_converter.py
"""Excel XLSX converter using openpyxl and pandas."""

from pathlib import Path
from typing import Any, Dict, List

import pandas as pd

from src.logging_config import get_logger
from src.models import ProcessorOutput
from src.sanitizer import InputSanitizer

from .base import FormatConverter

logger = get_logger(__name__)


class XlsxConverter(FormatConverter):
    """
    Converts Excel XLSX files to Markdown.
    Processes all sheets, uses table or sentence format based on size.
    """

    category = "tabular"
    MAX_TABLE_ROWS = 35
    MAX_TABLE_COLS = 20

    def __init__(self):
        self.sanitizer = InputSanitizer()

    async def to_markdown(self, file_path: str) -> ProcessorOutput:
        """Convert XLSX to Markdown."""
        try:
            path = Path(file_path)
            if not path.exists():
                return ProcessorOutput(
                    markdown="", metadata={"error": f"File not found: {file_path}"}
                )

            # Read all sheets
            try:
                xlsx = pd.ExcelFile(path, engine="openpyxl")
            except Exception as e:
                if "password" in str(e).lower() or "encrypt" in str(e).lower():
                    return ProcessorOutput(
                        markdown="",
                        metadata={"error": "PASSWORD_PROTECTED"},
                    )
                raise

            sheet_names = xlsx.sheet_names
            if not sheet_names:
                return ProcessorOutput(markdown="", metadata={})

            markdown_parts: List[str] = []
            total_rows = 0

            for sheet_name in sheet_names:
                df = pd.read_excel(xlsx, sheet_name=sheet_name, dtype=str)
                df = df.fillna("")

                # Skip empty sheets
                if df.empty:
                    continue

                total_rows += len(df)

                # Add sheet header
                markdown_parts.append(f"# {sheet_name}\n")

                # Convert based on size
                if (
                    len(df) <= self.MAX_TABLE_ROWS
                    and len(df.columns) <= self.MAX_TABLE_COLS
                ):
                    markdown_parts.append(self._to_markdown_table(df))
                else:
                    markdown_parts.append(self._to_sentence_format(df))

                markdown_parts.append("\n---\n")

            markdown = "\n".join(markdown_parts).strip()
            if markdown.endswith("---"):
                markdown = markdown[:-3].strip()

            metadata: Dict[str, Any] = {
                "sheet_count": len(sheet_names),
                "total_rows": total_rows,
            }

            logger.info(
                "xlsx_conversion_complete",
                path=file_path,
                sheets=len(sheet_names),
                rows=total_rows,
            )

            return ProcessorOutput(
                markdown=markdown, metadata=metadata, sheet_count=len(sheet_names)
            )

        except Exception as e:
            logger.exception("xlsx_conversion_error", path=file_path, error=str(e))
            return ProcessorOutput(markdown="", metadata={"error": str(e)})

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
