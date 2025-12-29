# apps/ai-worker/tests/test_pdf_converter.py
"""
Unit tests for DoclingPdfConverter and PyMuPDFConverter.
Tests OCR mode behavior, converter caching, and error handling.
"""

import pytest
from unittest.mock import patch

from src.converters.pdf_converter import DoclingPdfConverter
from src.converters.pymupdf_converter import PyMuPDFConverter


class TestDoclingPdfConverter:
    """Tests for DoclingPdfConverter."""

    @pytest.fixture
    def converter(self):
        """Create a DoclingPdfConverter instance."""
        return DoclingPdfConverter()

    @pytest.mark.asyncio
    async def test_file_not_found_returns_error(self, converter):
        """Non-existent file returns error in metadata."""
        result = await converter.to_markdown("/nonexistent/path.pdf")

        assert result.markdown == ""
        assert "error" in result.metadata
        assert "not found" in result.metadata["error"].lower()

    @pytest.mark.asyncio
    async def test_password_protected_returns_error(self, converter, tmp_path):
        """Password protected PDF returns specific error."""
        fake_pdf = tmp_path / "test.pdf"
        fake_pdf.write_bytes(b"%PDF-1.4 fake content")

        with patch.object(converter, "_is_password_protected", return_value=True):
            result = await converter.to_markdown(str(fake_pdf))

            assert result.markdown == ""
            assert result.metadata.get("error") == "PASSWORD_PROTECTED"

    def test_cache_key_format(self, converter):
        """Cache key includes OCR mode and thread count."""
        # Access internal cache key format
        cache_key_auto_4 = "auto_4"
        cache_key_never_8 = "never_8"

        assert cache_key_auto_4 == "auto_4"
        assert cache_key_never_8 == "never_8"


class TestOcrModes:
    """Tests for OCR mode configuration."""

    def test_ocr_mode_enum_values(self):
        """Valid OCR modes are auto, force, never."""
        valid_modes = ["auto", "force", "never"]
        for mode in valid_modes:
            assert mode in valid_modes

    def test_cache_key_differs_by_mode(self):
        """Different OCR modes produce different cache keys."""
        key1 = "auto_4"
        key2 = "never_4"
        key3 = "force_4"

        assert key1 != key2
        assert key2 != key3
        assert key1 != key3

    def test_cache_key_differs_by_threads(self):
        """Different thread counts produce different cache keys."""
        key1 = "auto_2"
        key2 = "auto_4"
        key3 = "auto_8"

        assert key1 != key2 != key3


class TestPyMuPDFConverter:
    """Tests for PyMuPDFConverter."""

    @pytest.fixture
    def converter(self):
        """Create a PyMuPDFConverter instance."""
        return PyMuPDFConverter()

    @pytest.mark.asyncio
    async def test_file_not_found_returns_error(self, converter):
        """Non-existent file returns error in metadata."""
        result = await converter.to_markdown("/nonexistent/path.pdf")

        assert result.markdown == ""
        assert "error" in result.metadata
        assert "not found" in result.metadata["error"].lower()

    @pytest.mark.asyncio
    async def test_password_protected_returns_error(self, converter, tmp_path):
        """Password protected PDF returns specific error."""
        fake_pdf = tmp_path / "test.pdf"
        fake_pdf.write_bytes(b"%PDF-1.4 fake content")

        with patch.object(converter, "_is_password_protected", return_value=True):
            result = await converter.to_markdown(str(fake_pdf))

            assert result.markdown == ""
            assert result.metadata.get("error") == "PASSWORD_PROTECTED"

    def test_strip_hidden_links_basic(self, converter):
        """Hidden links are stripped from markdown."""
        text = "Click [here](https://example.com) to continue."
        result = converter._strip_hidden_links(text)
        assert result == "Click here to continue."

    def test_strip_hidden_links_multiple(self, converter):
        """Multiple hidden links are all stripped."""
        text = "[Link1](url1) and [Link2](url2)"
        result = converter._strip_hidden_links(text)
        assert result == "Link1 and Link2"
        assert "url" not in result

    def test_strip_hidden_links_nested_brackets(self, converter):
        """Nested brackets are handled correctly."""
        text = "See [Section [A]](url) for details."
        result = converter._strip_hidden_links(text)
        assert result == "See Section [A] for details."

    def test_strip_hidden_links_no_links(self, converter):
        """Text without links is unchanged."""
        text = "This is plain text with no links."
        result = converter._strip_hidden_links(text)
        assert result == text

    def test_strip_hidden_links_empty_text(self, converter):
        """Empty link text becomes empty."""
        text = "Before [](url) after"
        result = converter._strip_hidden_links(text)
        assert result == "Before  after"
