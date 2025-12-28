# apps/ai-worker/tests/test_text_processor.py
"""
Unit tests for text-based converters.
Covers MD, TXT, JSON file processing after split into separate files.
"""

import pytest

from src.converters import MarkdownConverter, TxtConverter, JsonConverter


@pytest.fixture
def md_converter():
    """Create MarkdownConverter instance."""
    return MarkdownConverter()


@pytest.fixture
def txt_converter():
    """Create TxtConverter instance."""
    return TxtConverter()


@pytest.fixture
def json_converter():
    """Create JsonConverter instance."""
    return JsonConverter()


class TestMarkdownConverter:
    """Tests for MarkdownConverter."""

    @pytest.mark.asyncio
    async def test_process_md_passthrough(self, md_converter, tmp_path):
        """MD file content is processed but preserves structure."""
        md_file = tmp_path / "readme.md"
        md_content = "# Existing Heading\n\nSome content here."
        md_file.write_text(md_content)

        result = await md_converter.process(str(md_file), "md")

        assert "# Existing Heading" in result.markdown
        assert "Some content here" in result.markdown

    @pytest.mark.asyncio
    async def test_process_file_not_found(self, md_converter):
        """Missing file returns error in metadata."""
        result = await md_converter.process("/nonexistent/file.md", "md")

        assert result.markdown == ""
        assert "error" in result.metadata


class TestTxtConverter:
    """Tests for TxtConverter."""

    @pytest.mark.asyncio
    async def test_process_txt_success(self, txt_converter, tmp_path):
        """TXT file processed with heading added."""
        txt_file = tmp_path / "test.txt"
        txt_file.write_text("Hello world content")

        result = await txt_converter.process(str(txt_file), "txt")

        assert result.markdown is not None
        assert "# test.txt" in result.markdown
        assert "Hello world content" in result.markdown

    @pytest.mark.asyncio
    async def test_process_file_not_found(self, txt_converter):
        """Missing file returns error in metadata."""
        result = await txt_converter.process("/nonexistent/file.txt", "txt")

        assert result.markdown == ""
        assert "error" in result.metadata


class TestJsonConverter:
    """Tests for JsonConverter."""

    @pytest.mark.asyncio
    async def test_process_json_formats(self, json_converter, tmp_path):
        """JSON file formatted as code block."""
        json_file = tmp_path / "data.json"
        json_file.write_text('{"key": "value", "num": 123}')

        result = await json_converter.process(str(json_file), "json")

        assert "```json" in result.markdown
        assert '"key": "value"' in result.markdown

    @pytest.mark.asyncio
    async def test_process_invalid_json_error(self, json_converter, tmp_path):
        """Invalid JSON falls back to plain text block."""
        json_file = tmp_path / "bad.json"
        json_file.write_text("{invalid json content")

        result = await json_converter.process(str(json_file), "json")

        assert "```" in result.markdown
        assert "{invalid json content" in result.markdown

    @pytest.mark.asyncio
    async def test_process_tabular_json(self, json_converter, tmp_path):
        """Tabular JSON converted to sentence serialization."""
        json_file = tmp_path / "users.json"
        json_file.write_text(
            '[{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]'
        )

        result = await json_converter.process(str(json_file), "json")

        # Should contain sentence format
        assert "Name is Alice" in result.markdown
        assert "Age is 30" in result.markdown

    @pytest.mark.asyncio
    async def test_process_file_not_found(self, json_converter):
        """Missing file returns error in metadata."""
        result = await json_converter.process("/nonexistent/file.json", "json")

        assert result.markdown == ""
        assert "error" in result.metadata
