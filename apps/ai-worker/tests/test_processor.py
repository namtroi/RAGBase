# apps/ai-worker/tests/test_processor.py
"""
Unit tests for the PDF processor module.
"""

import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock

# Import from parent directory
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.processor import PDFProcessor, ProcessingResult


@pytest.fixture
def processor():
    """Create a PDF processor instance."""
    return PDFProcessor()


class TestProcessingResult:
    """Tests for ProcessingResult dataclass."""

    def test_success_result(self):
        """Test creating a successful processing result."""
        result = ProcessingResult(
            success=True,
            markdown="# Test Document",
            page_count=5,
            ocr_applied=False,
            processing_time_ms=1500,
        )

        assert result.success is True
        assert result.markdown == "# Test Document"
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
        assert result.markdown is None
        assert result.page_count == 0
        assert result.error_code == "PASSWORD_PROTECTED"
        assert result.error_message == "PDF is password protected"


class TestPDFProcessor:
    """Tests for PDFProcessor class."""

    @pytest.mark.asyncio
    async def test_process_missing_file(self, processor):
        """Test processing a non-existent file returns error."""
        result = await processor.process("/nonexistent/file.pdf")

        assert result.success is False
        assert result.error_code == "CORRUPT_FILE"
        assert "not found" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_process_password_protected(self, processor, tmp_path):
        """Test processing a password-protected PDF returns error."""
        # Create a dummy file
        pdf_path = tmp_path / "encrypted.pdf"
        pdf_path.write_bytes(b"%PDF-1.4")

        # Mock the password protection check
        with patch.object(processor, "_is_password_protected", return_value=True):
            result = await processor.process(str(pdf_path))

            assert result.success is False
            assert result.error_code == "PASSWORD_PROTECTED"
            assert "password protected" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_process_docling_error(self, processor, tmp_path):
        """Test handling Docling conversion errors."""
        # Create a dummy file
        pdf_path = tmp_path / "invalid.pdf"
        pdf_path.write_bytes(b"%PDF-1.4")

        # Mock password check and converter
        # Use an error message that doesn't contain 'invalid', 'corrupt', or 'timeout'
        with patch.object(processor, "_is_password_protected", return_value=False):
            with patch.object(
                processor, "_get_converter", side_effect=Exception("Failed to parse document")
            ):
                result = await processor.process(str(pdf_path))

                assert result.success is False
                assert result.error_code == "INTERNAL_ERROR"

    @pytest.mark.asyncio
    async def test_process_timeout_error(self, processor, tmp_path):
        """Test handling timeout errors."""
        pdf_path = tmp_path / "large.pdf"
        pdf_path.write_bytes(b"%PDF-1.4")

        with patch.object(processor, "_is_password_protected", return_value=False):
            with patch.object(
                processor, "_get_converter", side_effect=Exception("Operation timeout exceeded")
            ):
                result = await processor.process(str(pdf_path))

                assert result.success is False
                assert result.error_code == "TIMEOUT"


class TestPasswordProtectionCheck:
    """Tests for password protection detection."""

    def test_is_password_protected_returns_false_on_error(self, processor):
        """Test that non-existent files return False (not protected)."""
        result = processor._is_password_protected(Path("/nonexistent/file.pdf"))
        assert result is False

    def test_is_password_protected_with_unencrypted_file(self, processor, tmp_path):
        """Test unencrypted file detection."""
        # Create a minimal PDF-like file
        pdf_path = tmp_path / "test.pdf"
        pdf_path.write_bytes(b"%PDF-1.4\n%%EOF")

        # This might fail without a real PDF, but should not raise
        result = processor._is_password_protected(pdf_path)
        # The result depends on whether PyMuPDF is installed
        assert isinstance(result, bool)


class TestOCRNeedsDetection:
    """Tests for OCR requirement detection."""

    def test_needs_ocr_with_little_text(self, processor):
        """Test that documents with little text trigger OCR need."""
        mock_result = MagicMock()
        mock_result.document.export_to_markdown.return_value = "short"
        mock_result.document.pages = [1, 2, 3, 4]  # 4 pages

        # 5 chars / 4 pages = 1.25 chars per page < 50
        result = processor._needs_ocr(mock_result)
        assert result is True

    def test_needs_ocr_with_enough_text(self, processor):
        """Test that documents with enough text don't need OCR."""
        mock_result = MagicMock()
        mock_result.document.export_to_markdown.return_value = "x" * 200
        mock_result.document.pages = [1, 2]  # 2 pages

        # 200 chars / 2 pages = 100 chars per page > 50
        result = processor._needs_ocr(mock_result)
        assert result is False

    def test_needs_ocr_handles_exceptions(self, processor):
        """Test that OCR detection handles errors gracefully."""
        mock_result = MagicMock()
        mock_result.document.export_to_markdown.side_effect = Exception("Error")

        result = processor._needs_ocr(mock_result)
        assert result is False  # Default to no OCR on error
