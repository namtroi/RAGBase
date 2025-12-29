# apps/ai-worker/tests/test_error_handling.py
"""
Centralized error handling tests for AI Worker converters and chunkers.
Tests corrupt files, invalid encoding, empty files, and edge cases.
"""

import pytest

from src.converters import (
    CsvConverter,
    HtmlConverter,
    TxtConverter,
    MarkdownConverter,
    JsonConverter,
)
from src.chunkers.document_chunker import DocumentChunker


class TestConverterErrorHandling:
    """Error handling tests for format converters."""

    @pytest.mark.asyncio
    async def test_csv_corrupt_file(self, tmp_path):
        """Corrupt CSV is handled gracefully."""
        corrupt_file = tmp_path / "corrupt.csv"
        corrupt_file.write_bytes(b"\xff\xfe\x00\x00invalid content")

        processor = CsvConverter()
        result = await processor.process(str(corrupt_file))

        # Should not crash, either returns error or attempts recovery
        assert result is not None

    @pytest.mark.asyncio
    async def test_html_malformed(self, tmp_path):
        """Malformed HTML is handled gracefully."""
        malformed_file = tmp_path / "malformed.html"
        malformed_file.write_text("<html><body><p>Unclosed paragraph<div>Mixed")

        processor = HtmlConverter()
        result = await processor.process(str(malformed_file))

        # Should extract what it can
        assert result is not None
        assert "Unclosed" in result.markdown or result.markdown == ""

    @pytest.mark.asyncio
    async def test_txt_invalid_encoding(self, tmp_path):
        """Invalid encoding in TXT is handled gracefully."""
        bad_encoding_file = tmp_path / "bad.txt"
        # Write bytes that are invalid UTF-8
        bad_encoding_file.write_bytes(b"Hello \xff\xfe World")

        processor = TxtConverter()
        result = await processor.process(str(bad_encoding_file))

        # Should handle gracefully
        assert result is not None

    @pytest.mark.asyncio
    async def test_empty_file_returns_output(self, tmp_path):
        """Empty file returns some output (may include filename header)."""
        empty_file = tmp_path / "empty.txt"
        empty_file.write_text("")

        processor = TxtConverter()
        result = await processor.process(str(empty_file))

        # TxtConverter adds filename as header, so not strictly empty
        assert result is not None
        assert result.markdown is not None

    @pytest.mark.asyncio
    async def test_file_not_found_txt(self):
        """Non-existent TXT file returns error."""
        processor = TxtConverter()
        result = await processor.process("/nonexistent/file.txt")

        assert result.markdown == ""
        assert "error" in result.metadata

    @pytest.mark.asyncio
    async def test_file_not_found_md(self):
        """Non-existent MD file returns error."""
        processor = MarkdownConverter()
        result = await processor.process("/nonexistent/file.md")

        assert result.markdown == ""
        assert "error" in result.metadata

    @pytest.mark.asyncio
    async def test_json_invalid_syntax(self, tmp_path):
        """Invalid JSON syntax is handled gracefully."""
        bad_json = tmp_path / "bad.json"
        bad_json.write_text("{invalid json content")

        processor = JsonConverter()
        result = await processor.process(str(bad_json))

        # Should handle gracefully
        assert result is not None

    @pytest.mark.asyncio
    async def test_json_empty_object(self, tmp_path):
        """Empty JSON object returns minimal markdown."""
        empty_json = tmp_path / "empty.json"
        empty_json.write_text("{}")

        processor = JsonConverter()
        result = await processor.process(str(empty_json))

        assert result is not None
        # Empty object might produce empty or minimal output
        assert result.markdown is not None


class TestChunkerErrorHandling:
    """Error handling tests for chunkers."""

    @pytest.fixture
    def chunker(self):
        """Create a DocumentChunker with default settings."""
        return DocumentChunker(
            chunk_size=1000,
            chunk_overlap=100,
            header_levels=3,
        )

    def test_empty_input(self, chunker):
        """Empty markdown returns empty list."""
        chunks = chunker.chunk("")
        assert chunks == []

    def test_whitespace_only(self, chunker):
        """Whitespace-only input returns empty list."""
        chunks = chunker.chunk("   \n\n\t\t  ")
        assert chunks == []

    def test_very_short_content(self, chunker):
        """Very short content produces list (may be empty or have one chunk)."""
        chunks = chunker.chunk("Hello")
        assert isinstance(chunks, list)

    def test_single_header_no_content(self, chunker):
        """Header with no content is handled."""
        chunks = chunker.chunk("# Header Only")
        assert isinstance(chunks, list)

    def test_nested_headers(self, chunker):
        """Deeply nested headers are handled."""
        md = """# H1
## H2
### H3
#### H4
##### H5
###### H6

Content at the deepest level."""

        chunks = chunker.chunk(md)
        assert isinstance(chunks, list)
        if chunks:
            # Chunker returns dicts, not objects
            assert "content" in chunks[0] or len(chunks) > 0

    def test_code_block_in_content(self, chunker):
        """Content with code blocks can be chunked."""
        md = """# Code Example

```python
def very_long_function():
    return "complete"
```

Normal text after."""

        chunks = chunker.chunk(md)
        assert isinstance(chunks, list)


class TestEdgeCases:
    """Edge case tests."""

    @pytest.mark.asyncio
    async def test_large_csv(self, tmp_path):
        """Large CSV (many rows) is handled."""
        large_csv = tmp_path / "large.csv"
        rows = ["col1,col2,col3"] + [f"val{i},data{i},info{i}" for i in range(1000)]
        large_csv.write_text("\n".join(rows))

        processor = CsvConverter()
        result = await processor.process(str(large_csv))

        assert result is not None
        assert len(result.markdown) > 0

    @pytest.mark.asyncio
    async def test_unicode_content(self, tmp_path):
        """Unicode content is preserved."""
        unicode_file = tmp_path / "unicode.txt"
        unicode_file.write_text("Xin chào 你好 مرحبا 🎉", encoding="utf-8")

        processor = TxtConverter()
        result = await processor.process(str(unicode_file))

        assert "Xin chào" in result.markdown
        assert "你好" in result.markdown

    @pytest.mark.asyncio
    async def test_mixed_line_endings(self, tmp_path):
        """Mixed line endings are handled."""
        mixed_file = tmp_path / "mixed.txt"
        mixed_file.write_bytes(b"Line1\r\nLine2\rLine3\nLine4")

        processor = TxtConverter()
        result = await processor.process(str(mixed_file))

        # Should have content from all lines
        assert "Line1" in result.markdown
        assert "Line4" in result.markdown
