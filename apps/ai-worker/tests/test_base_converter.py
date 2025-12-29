# apps/ai-worker/tests/test_base_converter.py
"""
Unit tests for FormatConverter base class methods.
Tests _sanitize_raw() and _post_process() inherited methods.
"""

import pytest

from src.converters.base import FormatConverter
from src.models import ProcessorOutput


class ConcreteConverter(FormatConverter):
    """Concrete implementation for testing base class methods."""

    async def to_markdown(self, file_path: str) -> ProcessorOutput:
        return ProcessorOutput(markdown="test", metadata={})


@pytest.fixture
def converter():
    """Create a concrete converter instance."""
    return ConcreteConverter()


class TestSanitizeRaw:
    """Tests for FormatConverter._sanitize_raw() method."""

    def test_removes_null_bytes(self, converter):
        """Null bytes are removed from raw text."""
        text = "Hello\x00World"
        result = converter._sanitize_raw(text)
        assert "\x00" not in result
        assert result == "HelloWorld"

    def test_removes_control_characters(self, converter):
        """Control characters (except \\n, \\t) are removed."""
        text = "Hello\x01\x02World"
        result = converter._sanitize_raw(text)
        assert "\x01" not in result
        assert result == "HelloWorld"

    def test_preserves_newlines_and_tabs(self, converter):
        """Newlines and tabs are preserved."""
        text = "Line1\n\tIndented"
        result = converter._sanitize_raw(text)
        assert "\n" in result
        assert "\t" in result

    def test_removes_bom(self, converter):
        """BOM markers are stripped."""
        text = "\ufeffHello World"
        result = converter._sanitize_raw(text)
        assert not result.startswith("\ufeff")

    def test_normalizes_line_endings(self, converter):
        """Windows line endings are normalized to Unix."""
        text = "Line1\r\nLine2"
        result = converter._sanitize_raw(text)
        assert "\r\n" not in result
        assert "\n" in result


class TestPostProcess:
    """Tests for FormatConverter._post_process() method."""

    def test_standardizes_bullets(self, converter):
        """Bullets * and + are converted to -."""
        text = "* Item 1\n+ Item 2\n- Item 3"
        result = converter._post_process(text)
        assert "* " not in result
        assert "+ " not in result
        assert "- Item 1" in result
        assert "- Item 2" in result

    def test_collapses_blank_lines(self, converter):
        """Multiple blank lines collapse to max 2."""
        text = "Line1\n\n\n\n\nLine2"
        result = converter._post_process(text)
        assert "\n\n\n" not in result

    def test_removes_empty_sections(self, converter):
        """Headings with no content are removed."""
        text = "# Section 1\n\nContent\n\n# Empty\n\n# Section 2\n\nMore"
        result = converter._post_process(text)
        assert "# Empty" not in result
        assert "# Section 1" in result
        assert "# Section 2" in result

    def test_preserves_code_blocks(self, converter):
        """Code block content is not modified."""
        text = "```python\n* This is code\n```"
        result = converter._post_process(text)
        assert "* This is code" in result

    def test_fixes_unclosed_code_blocks(self, converter):
        """Unclosed code blocks are automatically closed."""
        text = "```python\ncode here"
        result = converter._post_process(text)
        assert result.count("```") == 2

    def test_empty_string(self, converter):
        """Empty string returns empty string."""
        result = converter._post_process("")
        assert result == ""


class TestSharedInstances:
    """Tests for shared sanitizer and normalizer instances."""

    def test_sanitizer_is_shared(self):
        """All converters share the same sanitizer instance."""
        conv1 = ConcreteConverter()
        conv2 = ConcreteConverter()
        assert conv1._sanitizer is conv2._sanitizer

    def test_normalizer_is_shared(self):
        """All converters share the same normalizer instance."""
        conv1 = ConcreteConverter()
        conv2 = ConcreteConverter()
        assert conv1._normalizer is conv2._normalizer


class TestPostProcessPdf:
    """Tests for FormatConverter._post_process_pdf() method."""

    def test_removes_page_artifacts(self, converter):
        """Page numbers are removed from PDF content."""
        text = "Content here.\n\n5\n\nMore content."
        result = converter._post_process_pdf(text)
        # Standalone page number should be removed
        assert "\n5\n" not in result
        assert "Content here." in result

    def test_removes_junk_code_blocks(self, converter):
        """Empty code blocks and page-number-only code blocks are removed."""
        text = "Content.\n\n```\n\n```\n\nMore."
        result = converter._post_process_pdf(text)
        assert "```" not in result
        assert "Content." in result

    def test_chain_normalizes_first(self, converter):
        """Normalization happens before artifact removal."""
        text = "* Bullet\n\n\n\n\n3\n\nEnd"
        result = converter._post_process_pdf(text)
        # Bullet should be standardized
        assert "- Bullet" in result
        # Multiple blank lines collapsed
        assert "\n\n\n" not in result


class TestPostProcessPymupdf:
    """Tests for FormatConverter._post_process_pymupdf() method."""

    def test_merges_soft_linebreaks(self, converter):
        """Soft linebreaks from PyMuPDF are merged."""
        text = "individuals and teams who\nmade this book possible."
        result = converter._post_process_pymupdf(text)
        assert "who made this" in result

    def test_full_chain(self, converter):
        """Full PyMuPDF chain: normalize + merge + page artifacts + junk blocks."""
        text = (
            "* Bullet\n"
            "The quick brown fox\n"
            "jumps over.\n\n"
            "5\n\n"
            "```\n\n```\n\n"
            "End."
        )
        result = converter._post_process_pymupdf(text)
        # Bullet standardized
        assert "- Bullet" in result
        # Soft linebreaks merged
        assert "fox jumps" in result
        # Page number removed
        assert "\n5\n" not in result
        # Empty code block removed
        assert "```" not in result

    def test_preserves_real_paragraph_breaks(self, converter):
        """Real paragraph breaks (sentence end + capital) are preserved."""
        text = "First sentence.\n\nSecond paragraph."
        result = converter._post_process_pymupdf(text)
        assert "\n\n" in result
        assert "sentence.\n" in result
