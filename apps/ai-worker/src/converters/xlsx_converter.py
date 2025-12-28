# apps/ai-worker/src/converters/xlsx_converter.py
"""Excel XLSX converter using openpyxl and pandas."""

from pathlib import Path
from typing import Any, Dict, List

import pandas as pd

from src.logging_config import get_logger
from src.models import ProcessorOutput

from .base import FormatConverter

logger = get_logger(__name__)


class XlsxConverter(FormatConverter):
    """
    Converts Excel XLSX files to Markdown.
    Processes all sheets, uses table or sentence format based on size.
    Phase 4: Adds smart formatting and context-aware sentence serialization.
    """

    category = "tabular"

    def __init__(self, max_table_rows: int = 35, max_table_cols: int = 20):
        """Initialize converter with configurable table size thresholds."""
        self.max_table_rows = max_table_rows
        self.max_table_cols = max_table_cols

    async def to_markdown(self, file_path: str) -> ProcessorOutput:
        """Convert XLSX to Markdown."""
        try:
            path = Path(file_path)
            if not path.exists():
                return ProcessorOutput(
                    markdown="", metadata={"error": f"File not found: {file_path}"}
                )

            # Read all sheets using openpyxl engine
            try:
                xlsx = pd.ExcelFile(path, engine="openpyxl")
            except Exception as e:
                if "password" in str(e).lower() or "encrypt" in str(e).lower():
                    return ProcessorOutput(
                        markdown="",
                        metadata={
                            "error": "PASSWORD_PROTECTED",
                            "message": "File is password protected. Remove password and re-upload.",
                        },
                    )
                raise

            sheet_names = xlsx.sheet_names
            if not sheet_names:
                return ProcessorOutput(markdown="", metadata={})

            markdown_parts: List[str] = []
            total_rows = 0

            for sheet_name in sheet_names:
                # Read sheet, forcing string type to preserve exact text (e.g. IDs with leading zeros)
                df = pd.read_excel(xlsx, sheet_name=sheet_name, dtype=str)
                df = df.fillna("")

                # Skip empty sheets
                if df.empty:
                    continue

                total_rows += len(df)

                # Add sheet header (Phase 4: Context)
                markdown_parts.append(f"# {sheet_name}\n")

                # Decision Logic: Table vs Sentence
                if (
                    len(df) <= self.max_table_rows
                    and len(df.columns) <= self.max_table_cols
                ):
                    markdown_parts.append(self._to_markdown_table(df))
                else:
                    # Pass sheet_name to inject context into every sentence
                    markdown_parts.append(self._to_sentence_format(df, sheet_name))

                markdown_parts.append("\n---\n")

            markdown = "\n".join(markdown_parts).strip()
            if markdown.endswith("---"):
                markdown = markdown[:-3].strip()

            # Sanitize + Post-process (consistent with CSV approach)
            markdown = self._sanitize_raw(markdown)
            markdown = self._post_process(markdown)

            metadata: Dict[str, Any] = {
                "sheet_count": len(sheet_names),
                "total_rows": total_rows,
                "source_format": "xlsx",
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

    def _format_smart_value(self, header: str, value: str) -> str:
        """
        Phase 4: Smart Number Formatting.
        Applies semantic formatting based on header keywords and value type.
        (Duplicated logic from CSV to keep converters independent)
        """
        header_lower = str(header).lower()
        value = str(value).strip()

        if not value:
            return ""

        try:
            clean_val = value.replace(",", "")
            float_val = float(clean_val)
            is_number = True
        except ValueError:
            is_number = False

        if is_number:
            # Currency
            if any(
                k in header_lower
                for k in ["revenue", "price", "cost", "salary", "usd", "amount"]
            ):
                if not value.startswith("$") and not value.startswith("€"):
                    return f"${float_val:,.2f}"

            # Percentage
            if "rate" in header_lower or "percent" in header_lower:
                if float_val < 1.0:
                    return f"{float_val:.1%}"
                return f"{float_val}%"

            # Large Numbers
            if float_val > 999:
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

        return value

    def _to_markdown_table(self, df: pd.DataFrame) -> str:
        if len(df.columns) == 0:
            return ""

        lines: List[str] = []
        headers = list(df.columns)

        # Escape pipes in headers
        safe_headers = [
            str(h).replace("|", "&#124;").replace("\n", " ") for h in headers
        ]

        lines.append("| " + " | ".join(safe_headers) + " |")
        lines.append("| " + " | ".join("---" for _ in headers) + " |")

        for _, row in df.iterrows():
            cells = []
            for v in row:
                val = str(v).strip()
                # Escape pipes and newlines for valid markdown table
                val = val.replace("|", "&#124;").replace("\n", "<br>")
                cells.append(val)
            lines.append("| " + " | ".join(cells) + " |")

        return "\n".join(lines)

    def _to_sentence_format(self, df: pd.DataFrame, sheet_name: str) -> str:
        """
        Phase 4: Sentence Serialization.
        Format: "Sheet: {Name}. {Header} is {Value}."
        """
        if df.empty:
            return ""

        lines: List[str] = []
        headers = list(df.columns)

        for _, row in df.iterrows():
            # Phase 4: Start with Sheet context
            row_parts: List[str] = [f"Sheet: {sheet_name}"]

            for header in headers:
                raw_val = str(row[header])
                if not raw_val or raw_val.strip() == "":
                    continue

                formatted_val = self._format_smart_value(str(header), raw_val)
                clean_header = str(header).strip()

                # Syntax: "{Header} is {Value}"
                row_parts.append(f"{clean_header} is {formatted_val}")

            if len(row_parts) > 1:
                # Join with periods.
                lines.append(". ".join(row_parts) + ".")
                lines.append("")  # Spacer

        return "\n".join(lines).strip()
