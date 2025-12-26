# apps/ai-worker/tests/test_text_processor.py
"""
Unit tests for TextConverter module.
Covers MD, TXT, JSON file processing and format conversion.
"""

import pytest

from src.converters import TextConverter
from src.converters.text_converter import JsonConverter


@pytest.fixture
def processor():
    """Create TextConverter instance."""
    return TextConverter()


class TestTextProcessorProcess:
    """Tests for TextConverter.process() method."""

    @pytest.mark.asyncio
    async def test_process_txt_success(self, processor, tmp_path):
        """TXT file processed with heading added."""
        txt_file = tmp_path / "test.txt"
        txt_file.write_text("Hello world content")

        result = await processor.process(str(txt_file), "txt")

        assert result.markdown is not None
        assert "# test.txt" in result.markdown
        assert "Hello world content" in result.markdown

    @pytest.mark.asyncio
    async def test_process_md_passthrough(self, processor, tmp_path):
        """MD file content is processed but preserves structure."""
        md_file = tmp_path / "readme.md"
        md_content = "# Existing Heading\n\nSome content here."
        md_file.write_text(md_content)

        result = await processor.process(str(md_file), "md")

        # Content is post-processed but structure is preserved
        assert "# Existing Heading" in result.markdown
        assert "Some content here" in result.markdown

    @pytest.mark.asyncio
    async def test_process_json_formats(self, processor, tmp_path):
        """JSON file formatted as code block using JsonConverter."""
        json_file = tmp_path / "data.json"
        json_file.write_text('{"key": "value", "num": 123}')

        # Use JsonConverter for JSON files
        json_processor = JsonConverter()
        result = await json_processor.process(str(json_file), "json")

        assert "```json" in result.markdown
        assert '"key": "value"' in result.markdown

    @pytest.mark.asyncio
    async def test_process_invalid_json_error(self, processor, tmp_path):
        """Invalid JSON in JsonConverter falls back to plain text block."""
        json_file = tmp_path / "bad.json"
        json_file.write_text("{invalid json content")

        # Use JsonConverter for JSON files
        json_processor = JsonConverter()
        result = await json_processor.process(str(json_file), "json")

        # Should still return markdown - _to_markdown catches JSONDecodeError
        assert "```" in result.markdown
        assert "{invalid json content" in result.markdown

    @pytest.mark.asyncio
    async def test_process_file_not_found(self, processor):
        """Missing file returns error in metadata."""
        result = await processor.process("/nonexistent/file.txt", "txt")

        assert result.markdown == ""
        assert "error" in result.metadata


class TestToMarkdown:
    """Tests for TextConverter._to_markdown() method."""

    def test_to_markdown_txt(self):
        """TXT format adds filename heading."""
        proc = TextConverter()
        result = proc._to_markdown("content here", "txt", "notes.txt")

        assert result == "# notes.txt\n\ncontent here"

    def test_to_markdown_json(self):
        """JSON format pretty prints in code block (via JsonConverter)."""
        proc = JsonConverter()
        result = proc._to_markdown('{"a":1}', "json", "config.json")

        assert "# config.json" in result
        assert "```json" in result
        assert '"a": 1' in result  # Pretty printed with space

    def test_to_markdown_unknown_format(self):
        """Unknown format treated as plain text."""
        proc = TextConverter()
        result = proc._to_markdown("raw content", "xyz", "file.xyz")

        assert result == "# file.xyz\n\nraw content"
