# apps/ai-worker/tests/test_processor.py
"""
Unit tests for the PDF processor module.
"""

# Import from parent directory
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.processor import PDFProcessor
from src.models import ProcessingResult


@pytest.fixture
def processor():
    """Create a PDF processor instance with mocked dependencies if needed."""
    return PDFProcessor()


class TestProcessingResult:
    """Tests for ProcessingResult dataclass."""

    def test_success_result_phase2(self):
        """Test creating a successful processing result with new fields."""
        result = ProcessingResult(
            success=True,
            processed_content="# Test Document",
            page_count=5,
            ocr_applied=False,
            processing_time_ms=1500,
            chunks=[{"content": "chunk", "index": 0, "embedding": [0.1] * 384}],
        )

        assert result.success is True
        assert result.processed_content == "# Test Document"
        assert len(result.chunks) == 1
        assert result.chunks[0]["embedding"] == [0.1] * 384
        assert result.page_count == 5
        assert result.ocr_applied is False
        assert result.processing_time_ms == 1500
        assert result.error_code is None
        assert result.error_message is None

    def test_failure_result(self):
        """Test creating a failure processing result."""
        result = ProcessingResult(
            success=False,
            error_code="PASSWORD_PROTECTED",
            error_message="PDF is password protected",
        )

        assert result.success is False
        assert result.chunks is None or result.chunks == []
        assert result.error_code == "PASSWORD_PROTECTED"


class TestPDFProcessor:
    """Tests for PDFProcessor class."""

    @pytest.mark.asyncio
    async def test_process_success_flow(self, processor, tmp_path):
        """Test successful processing flow including chunking and embedding."""
        pdf_path = tmp_path / "valid.pdf"
        pdf_path.write_bytes(b"%PDF-1.4")

        # Mock dependencies
        with patch.object(
            processor, "_is_password_protected", return_value=False
        ), patch.object(processor, "_get_converter") as MockGetConverter:

            # Mock Docling Converter
            mock_converter = MagicMock()
            mock_doc_res = MagicMock()
            mock_doc_res.document.export_to_markdown.return_value = "# Markdown Content"
            mock_doc_res.document.pages = [1]
            mock_converter.convert.return_value = mock_doc_res
            MockGetConverter.return_value = mock_converter

            # Mock Chunker directly on the instance
            processor.chunker = MagicMock()
            processor.chunker.chunk.return_value = [
                {"content": "chunk1", "index": 0, "metadata": {}}
            ]

            # Mock Embedder directly on the instance (overriding singleton behavior for this test)
            processor.embedder = MagicMock()
            processor.embedder.embed.return_value = [[0.1] * 384]

            result = await processor.process(str(pdf_path))

            assert result.success is True
            assert result.processed_content == "# Markdown Content"
            assert len(result.chunks) == 1
            assert result.chunks[0]["embedding"] == [0.1] * 384
            assert result.chunks[0]["content"] == "chunk1"

    @pytest.mark.asyncio
    async def test_process_missing_file(self, processor):
        """Test processing a non-existent file returns error."""
        result = await processor.process("/nonexistent/file.pdf")
        assert result.success is False
        assert result.error_code == "CORRUPT_FILE"

    @pytest.mark.asyncio
    async def test_process_timeout_error(self, processor, tmp_path):
        """Test handling timeout errors."""
        pdf_path = tmp_path / "large.pdf"
        pdf_path.write_bytes(b"%PDF-1.4")

        with patch.object(processor, "_is_password_protected", return_value=False):
            with patch.object(processor, "_get_converter") as MockGetConverter:
                MockGetConverter.side_effect = Exception("Operation timeout exceeded")

                result = await processor.process(str(pdf_path))
                assert result.success is False
                assert result.error_code == "TIMEOUT"


class TestDocxProcessor:
    """Tests for DOCX processing via PDFProcessor (Docling)."""

    @pytest.mark.asyncio
    async def test_extract_paragraphs(self, processor, tmp_path):
        """DOCX paragraphs are extracted as markdown."""
        docx_path = tmp_path / "test.docx"
        docx_path.write_bytes(b"PK")  # Minimal zip header

        with patch.object(
            processor, "_is_password_protected", return_value=False
        ), patch.object(processor, "_get_converter") as MockGetConverter:

            mock_converter = MagicMock()
            mock_doc_res = MagicMock()
            mock_doc_res.document.export_to_markdown.return_value = (
                "First paragraph.\n\nSecond paragraph."
            )
            mock_doc_res.document.pages = [1]
            mock_converter.convert.return_value = mock_doc_res
            MockGetConverter.return_value = mock_converter

            processor.chunker = MagicMock()
            processor.chunker.chunk.return_value = [
                {"content": "chunk", "index": 0, "metadata": {}}
            ]
            processor.embedder = MagicMock()
            processor.embedder.embed.return_value = [[0.1] * 384]

            result = await processor.process(str(docx_path))

            assert result.success is True
            assert "First paragraph" in result.processed_content
            assert "Second paragraph" in result.processed_content

    @pytest.mark.asyncio
    async def test_preserve_headings(self, processor, tmp_path):
        """DOCX headings are converted to markdown headings."""
        docx_path = tmp_path / "headings.docx"
        docx_path.write_bytes(b"PK")

        with patch.object(
            processor, "_is_password_protected", return_value=False
        ), patch.object(processor, "_get_converter") as MockGetConverter:

            mock_converter = MagicMock()
            mock_doc_res = MagicMock()
            mock_doc_res.document.export_to_markdown.return_value = (
                "# Main Title\n\n## Subtitle\n\nContent here."
            )
            mock_doc_res.document.pages = [1]
            mock_converter.convert.return_value = mock_doc_res
            MockGetConverter.return_value = mock_converter

            processor.chunker = MagicMock()
            processor.chunker.chunk.return_value = [
                {"content": "chunk", "index": 0, "metadata": {}}
            ]
            processor.embedder = MagicMock()
            processor.embedder.embed.return_value = [[0.1] * 384]

            result = await processor.process(str(docx_path))

            assert result.success is True
            assert "# Main Title" in result.processed_content
            assert "## Subtitle" in result.processed_content

    @pytest.mark.asyncio
    async def test_preserve_lists(self, processor, tmp_path):
        """DOCX lists are converted to markdown lists."""
        docx_path = tmp_path / "lists.docx"
        docx_path.write_bytes(b"PK")

        with patch.object(
            processor, "_is_password_protected", return_value=False
        ), patch.object(processor, "_get_converter") as MockGetConverter:

            mock_converter = MagicMock()
            mock_doc_res = MagicMock()
            mock_doc_res.document.export_to_markdown.return_value = (
                "- Item 1\n- Item 2\n- Item 3"
            )
            mock_doc_res.document.pages = [1]
            mock_converter.convert.return_value = mock_doc_res
            MockGetConverter.return_value = mock_converter

            processor.chunker = MagicMock()
            processor.chunker.chunk.return_value = [
                {"content": "chunk", "index": 0, "metadata": {}}
            ]
            processor.embedder = MagicMock()
            processor.embedder.embed.return_value = [[0.1] * 384]

            result = await processor.process(str(docx_path))

            assert result.success is True
            assert "- Item 1" in result.processed_content

    @pytest.mark.asyncio
    async def test_convert_tables(self, processor, tmp_path):
        """DOCX tables are converted to markdown tables."""
        docx_path = tmp_path / "tables.docx"
        docx_path.write_bytes(b"PK")

        with patch.object(
            processor, "_is_password_protected", return_value=False
        ), patch.object(processor, "_get_converter") as MockGetConverter:

            mock_converter = MagicMock()
            mock_doc_res = MagicMock()
            mock_doc_res.document.export_to_markdown.return_value = (
                "| Name | Age |\n|---|---|\n| Alice | 30 |"
            )
            mock_doc_res.document.pages = [1]
            mock_converter.convert.return_value = mock_doc_res
            MockGetConverter.return_value = mock_converter

            processor.chunker = MagicMock()
            processor.chunker.chunk.return_value = [
                {"content": "chunk", "index": 0, "metadata": {}}
            ]
            processor.embedder = MagicMock()
            processor.embedder.embed.return_value = [[0.1] * 384]

            result = await processor.process(str(docx_path))

            assert result.success is True
            assert "|" in result.processed_content
            assert "Alice" in result.processed_content

    @pytest.mark.asyncio
    async def test_password_protected_error(self, processor, tmp_path):
        """Password-protected DOCX returns error."""
        docx_path = tmp_path / "protected.docx"
        docx_path.write_bytes(b"PK")

        with patch.object(processor, "_is_password_protected", return_value=True):
            result = await processor.process(str(docx_path))

            assert result.success is False
            assert result.error_code == "PASSWORD_PROTECTED"
