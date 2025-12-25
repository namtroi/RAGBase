# apps/ai-worker/tests/test_csv_processor.py
"""
Unit tests for CsvProcessor module.
Tests CSV parsing, encoding detection, delimiter detection, and output formatting.
"""

import pytest
from pathlib import Path

from src.converters import CsvConverter as CsvProcessor
from src.models import ProcessorOutput


@pytest.fixture
def processor():
    """Create CsvProcessor instance."""
    return CsvProcessor()


@pytest.fixture
def csv_fixtures(fixtures_dir: Path) -> Path:
    """Return the CSV fixtures directory path."""
    return fixtures_dir / "csv"


class TestCsvProcessorBasic:
    """Tests for basic CSV parsing."""

    @pytest.mark.asyncio
    async def test_parse_simple_csv(self, processor, tmp_path):
        """Simple CSV file is parsed correctly."""
        csv_file = tmp_path / "simple.csv"
        csv_file.write_text("Name,Age,City\nAlice,30,NYC\nBob,25,LA\n")

        result = await processor.process(str(csv_file))

        assert isinstance(result, ProcessorOutput)
        assert "Name" in result.markdown
        assert "Alice" in result.markdown
        assert "30" in result.markdown

    @pytest.mark.asyncio
    async def test_parse_empty_csv(self, processor, tmp_path):
        """Empty CSV returns empty markdown."""
        csv_file = tmp_path / "empty.csv"
        csv_file.write_text("")

        result = await processor.process(str(csv_file))

        assert result.markdown == ""

    @pytest.mark.asyncio
    async def test_header_only_csv(self, processor, tmp_path):
        """CSV with only headers returns just header row."""
        csv_file = tmp_path / "headers.csv"
        csv_file.write_text("Name,Age,City\n")

        result = await processor.process(str(csv_file))

        assert "Name" in result.markdown
        # Should have table format but no data rows
        assert result.markdown.count("|") > 0


class TestCsvProcessorEncoding:
    """Tests for encoding detection."""

    @pytest.mark.asyncio
    async def test_parse_utf8_csv(self, processor, tmp_path):
        """UTF-8 encoded CSV with special chars is parsed correctly."""
        csv_file = tmp_path / "utf8.csv"
        csv_file.write_bytes("Name,City\nCafé,München\n日本語,東京\n".encode("utf-8"))

        result = await processor.process(str(csv_file))

        assert "Café" in result.markdown
        assert "München" in result.markdown
        assert "日本語" in result.markdown

    @pytest.mark.asyncio
    async def test_parse_latin1_csv(self, processor, tmp_path):
        """Latin-1 encoded CSV is detected and parsed correctly."""
        csv_file = tmp_path / "latin1.csv"
        csv_file.write_bytes("Name,City\nCafé,São Paulo\n".encode("latin-1"))

        result = await processor.process(str(csv_file))

        assert "Café" in result.markdown
        assert "São Paulo" in result.markdown

    @pytest.mark.asyncio
    async def test_parse_bom_csv(self, processor, tmp_path):
        """CSV with UTF-8 BOM is handled correctly."""
        csv_file = tmp_path / "bom.csv"
        content = "\ufeffName,Age\nTest,25\n"
        csv_file.write_bytes(content.encode("utf-8-sig"))

        result = await processor.process(str(csv_file))

        assert "Name" in result.markdown
        assert "Test" in result.markdown
        # BOM should not appear in output
        assert "\ufeff" not in result.markdown


class TestCsvProcessorDelimiter:
    """Tests for delimiter detection."""

    @pytest.mark.asyncio
    async def test_detect_comma_delimiter(self, processor, tmp_path):
        """Comma-delimited CSV is detected correctly."""
        csv_file = tmp_path / "comma.csv"
        csv_file.write_text("a,b,c\n1,2,3\n")

        result = await processor.process(str(csv_file))

        assert "| a |" in result.markdown or "| a " in result.markdown

    @pytest.mark.asyncio
    async def test_detect_semicolon_delimiter(self, processor, tmp_path):
        """Semicolon-delimited CSV is detected correctly."""
        csv_file = tmp_path / "semicolon.csv"
        csv_file.write_text("a;b;c\n1;2;3\n")

        result = await processor.process(str(csv_file))

        assert "| a |" in result.markdown or "| a " in result.markdown
        # Should NOT contain semicolons as content separators
        assert result.markdown.count(";") == 0

    @pytest.mark.asyncio
    async def test_detect_tab_delimiter(self, processor, tmp_path):
        """Tab-delimited CSV (TSV) is detected correctly."""
        csv_file = tmp_path / "tab.csv"
        csv_file.write_text("a\tb\tc\n1\t2\t3\n")

        result = await processor.process(str(csv_file))

        assert "| a |" in result.markdown or "| a " in result.markdown


class TestCsvProcessorEdgeCases:
    """Tests for edge cases."""

    @pytest.mark.asyncio
    async def test_quoted_fields(self, processor, tmp_path):
        """Quoted fields with commas are handled correctly."""
        csv_file = tmp_path / "quoted.csv"
        csv_file.write_text('Name,Description\nTest,"Hello, World"\n')

        result = await processor.process(str(csv_file))

        assert "Hello, World" in result.markdown

    @pytest.mark.asyncio
    async def test_multiline_fields(self, processor, tmp_path):
        """Multiline fields are handled correctly."""
        csv_file = tmp_path / "multiline.csv"
        csv_file.write_text('Name,Notes\nTest,"Line 1\nLine 2"\n')

        result = await processor.process(str(csv_file))

        # Multiline should be preserved or converted to space
        assert "Test" in result.markdown
        assert "Line 1" in result.markdown or "Line 1 Line 2" in result.markdown

    @pytest.mark.asyncio
    async def test_file_not_found(self, processor):
        """Missing file returns error in output."""
        result = await processor.process("/nonexistent/file.csv")

        assert result.markdown == ""
        assert "error" in result.metadata


class TestCsvProcessorSizeThresholds:
    """Tests for size-based formatting."""

    @pytest.mark.asyncio
    async def test_small_table_markdown_format(self, processor, tmp_path):
        """Small table (≤35 rows) outputs markdown table."""
        csv_file = tmp_path / "small.csv"
        # Create 10 rows (header + 9 data)
        lines = ["Name,Age,City"]
        for i in range(9):
            lines.append(f"Person{i},{20+i},City{i}")
        csv_file.write_text("\n".join(lines))

        result = await processor.process(str(csv_file))

        # Should contain markdown table format
        assert "|" in result.markdown
        assert "---" in result.markdown  # Table separator
        assert "Person0" in result.markdown

    @pytest.mark.asyncio
    async def test_large_table_sentence_format(self, processor, tmp_path):
        """Large table (>35 rows) outputs sentence format."""
        csv_file = tmp_path / "large.csv"
        # Create 40 rows (header + 39 data)
        lines = ["Name,Age"]
        for i in range(39):
            lines.append(f"Person{i},{20+i}")
        csv_file.write_text("\n".join(lines))

        result = await processor.process(str(csv_file))

        # Should contain sentence format, not table
        # Looking for patterns like "Name is Person0" or "**Name:** Person0"
        assert "Person0" in result.markdown
        # Large tables should not have table separators
        assert "---" not in result.markdown or result.markdown.count("|") < 5


class TestCsvProcessorMetadata:
    """Tests for metadata output."""

    @pytest.mark.asyncio
    async def test_metadata_includes_row_count(self, processor, tmp_path):
        """Metadata includes row count."""
        csv_file = tmp_path / "count.csv"
        csv_file.write_text("A,B\n1,2\n3,4\n5,6\n")

        result = await processor.process(str(csv_file))

        assert "row_count" in result.metadata
        assert result.metadata["row_count"] == 3

    @pytest.mark.asyncio
    async def test_metadata_includes_column_count(self, processor, tmp_path):
        """Metadata includes column count."""
        csv_file = tmp_path / "cols.csv"
        csv_file.write_text("A,B,C,D\n1,2,3,4\n")

        result = await processor.process(str(csv_file))

        assert "column_count" in result.metadata
        assert result.metadata["column_count"] == 4
