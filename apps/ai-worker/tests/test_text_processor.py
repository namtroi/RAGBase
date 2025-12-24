# apps/ai-worker/tests/test_text_processor.py
"""
Unit tests for TextProcessor module.
Covers MD, TXT, JSON file processing and format conversion.
"""

from unittest.mock import MagicMock

import pytest

from src.text_processor import TextProcessor


@pytest.fixture
def processor():
    """Create TextProcessor with mocked dependencies."""
    proc = TextProcessor()
    # Mock chunker and embedder to avoid real ML model loading
    proc.chunker = MagicMock()
    proc.chunker.chunk.return_value = [
        {"content": "chunk1", "index": 0, "metadata": {"charStart": 0, "charEnd": 6}}
    ]
    proc.embedder = MagicMock()
    proc.embedder.embed.return_value = [[0.1] * 384]
    return proc


class TestTextProcessorProcess:
    """Tests for TextProcessor.process() method."""

    @pytest.mark.asyncio
    async def test_process_txt_success(self, processor, tmp_path):
        """TXT file processed with heading added."""
        txt_file = tmp_path / "test.txt"
        txt_file.write_text("Hello world content")

        result = await processor.process(str(txt_file), "txt")

        assert result.success is True
        assert "# test.txt" in result.processed_content
        assert "Hello world content" in result.processed_content
        assert len(result.chunks) == 1
        assert result.chunks[0]["embedding"] == [0.1] * 384

    @pytest.mark.asyncio
    async def test_process_md_passthrough(self, processor, tmp_path):
        """MD file content unchanged."""
        md_file = tmp_path / "readme.md"
        md_content = "# Existing Heading\n\nSome content here."
        md_file.write_text(md_content)

        result = await processor.process(str(md_file), "md")

        assert result.success is True
        assert result.processed_content == md_content

    @pytest.mark.asyncio
    async def test_process_json_formats(self, processor, tmp_path):
        """JSON file formatted as code block."""
        json_file = tmp_path / "data.json"
        json_file.write_text('{"key": "value", "num": 123}')

        result = await processor.process(str(json_file), "json")

        assert result.success is True
        assert "```json" in result.processed_content
        assert '"key": "value"' in result.processed_content

    @pytest.mark.asyncio
    async def test_process_invalid_json_error(self, processor, tmp_path):
        """Invalid JSON in _to_markdown falls back to plain text block."""
        json_file = tmp_path / "bad.json"
        json_file.write_text("{invalid json content")

        result = await processor.process(str(json_file), "json")

        # Should still succeed - _to_markdown catches JSONDecodeError and wraps as plain text
        assert result.success is True
        assert "```" in result.processed_content
        assert "{invalid json content" in result.processed_content

    @pytest.mark.asyncio
    async def test_process_file_not_found(self, processor):
        """Missing file returns CORRUPT_FILE error."""
        result = await processor.process("/nonexistent/file.txt", "txt")

        assert result.success is False
        assert result.error_code == "CORRUPT_FILE"
        assert "not found" in result.error_message.lower()


class TestToMarkdown:
    """Tests for TextProcessor._to_markdown() method."""

    def test_to_markdown_txt(self):
        """TXT format adds filename heading."""
        proc = TextProcessor.__new__(TextProcessor)
        result = proc._to_markdown("content here", "txt", "notes.txt")

        assert result == "# notes.txt\n\ncontent here"

    def test_to_markdown_json(self):
        """JSON format pretty prints in code block."""
        proc = TextProcessor.__new__(TextProcessor)
        result = proc._to_markdown('{"a":1}', "json", "config.json")

        assert "# config.json" in result
        assert "```json" in result
        assert '"a": 1' in result  # Pretty printed with space

    def test_to_markdown_unknown_format(self):
        """Unknown format treated as plain text."""
        proc = TextProcessor.__new__(TextProcessor)
        result = proc._to_markdown("raw content", "xyz", "file.xyz")

        assert result == "# file.xyz\n\nraw content"
