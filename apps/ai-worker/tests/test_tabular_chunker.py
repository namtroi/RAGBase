# apps/ai-worker/tests/test_tabular_chunker.py
"""
Unit tests for TabularChunker.
Tests handling of Markdown tables and sentence-based row formats.
"""

import pytest
from src.chunkers.tabular_chunker import TabularChunker


@pytest.fixture
def chunker():
    """Create a TabularChunker instance."""
    return TabularChunker(rows_per_chunk=2)  # Small for easy testing


class TestTabularChunker:
    """Tests for TabularChunker class."""

    def test_markdown_table_single_chunk(self, chunker):
        """Test that a Markdown table stays as a single chunk."""
        text = "| Name | Age |\n|---|---|\n| Alice | 30 |\n| Bob | 25 |"
        chunks = chunker.chunk(text)

        assert len(chunks) == 1
        assert "| Name |" in chunks[0]["content"]
        assert "Alice" in chunks[0]["content"]
        assert chunks[0]["metadata"]["chunk_type"] == "tabular"

    def test_sentence_format_splitting(self, chunker):
        """Test that sentence-based row format is split by rows_per_chunk."""
        # Each "row" is "**H:** V; ..." followed by a blank line
        text = (
            "**Name:** Alice; **Age:** 30.\n\n"
            "**Name:** Bob; **Age:** 25.\n\n"
            "**Name:** Charlie; **Age:** 35.\n\n"
            "**Name:** David; **Age:** 40."
        )
        # rows_per_chunk=2, so we expect 2 chunks
        chunks = chunker.chunk(text)

        assert len(chunks) == 2
        assert "Alice" in chunks[0]["content"]
        assert "Bob" in chunks[0]["content"]
        assert "Charlie" in chunks[1]["content"]
        assert "David" in chunks[1]["content"]

    def test_breadcrumb_extraction_from_h1(self, chunker):
        """Test that sheet name is extracted from # Heading."""
        text = "# Sheet1\n\n**A:** 1.\n\n**B:** 2."
        chunks = chunker.chunk(text)

        assert any("Sheet1" in c["metadata"]["breadcrumbs"] for c in chunks)

    def test_multiple_sheets(self, chunker):
        """Test handling multiple sheets separated by ---."""
        text = "# Sheet1\n\n**A:** 1.\n\n" "---\n\n" "# Sheet2\n\n**X:** 10."
        chunks = chunker.chunk(text)

        assert len(chunks) >= 2
        # Check breadcrumbs for each chunk
        sheet1_chunks = [c for c in chunks if "Sheet1" in c["metadata"]["breadcrumbs"]]
        sheet2_chunks = [c for c in chunks if "Sheet2" in c["metadata"]["breadcrumbs"]]
        assert len(sheet1_chunks) > 0
        assert len(sheet2_chunks) > 0

    def test_empty_input(self, chunker):
        """Test handling of empty or whitespace input."""
        assert chunker.chunk("") == []
        assert chunker.chunk("   ") == []

    def test_mixed_content(self, chunker):
        """Test mixed Markdown table and sentence format."""
        text = (
            "# Table1\n| A | B |\n|---|---|\n| 1 | 2 |\n\n"
            "---\n\n"
            "# Table2\n**C:** 3.\n\n**D:** 4."
        )
        chunks = chunker.chunk(text)
        assert len(chunks) >= 2

    def test_large_markdown_table_stays_single_chunk(self, chunker):
        """Large Markdown tables remain as single chunk (current behavior)."""
        # Generate a large table with 100 rows
        header = "| Name | Age | City |\n|---|---|---|\n"
        rows = "| Alice | 30 | NYC |\n" * 100
        large_table = header + rows

        chunks = chunker.chunk(large_table)

        # Current behavior: Markdown tables are kept as single chunk
        assert len(chunks) == 1
        assert chunks[0]["metadata"]["chunk_type"] == "tabular"
        assert "Alice" in chunks[0]["content"]
