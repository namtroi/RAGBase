# apps/ai-worker/tests/test_pymupdf_converter.py
"""
Unit tests for PyMuPDFConverter.
Tests _strip_hidden_links() method for markdown link removal.
"""

import pytest

from src.converters.pymupdf_converter import PyMuPDFConverter


@pytest.fixture
def converter():
    """Create a PyMuPDFConverter instance."""
    return PyMuPDFConverter()


class TestStripHiddenLinks:
    """Tests for PyMuPDFConverter._strip_hidden_links() method."""

    def test_basic_link(self, converter):
        """Basic markdown link is stripped, keeping display text."""
        text = "Click [here](https://example.com) to continue."
        result = converter._strip_hidden_links(text)
        assert result == "Click here to continue."
        assert "https://" not in result

    def test_nested_brackets(self, converter):
        """Link text with nested brackets is preserved correctly."""
        text = "See [Section [A]](url) for details."
        result = converter._strip_hidden_links(text)
        assert result == "See Section [A] for details."

    def test_multiple_links(self, converter):
        """Multiple links in text are all stripped."""
        text = "[Link1](url1) and [Link2](url2) and [Link3](url3)"
        result = converter._strip_hidden_links(text)
        assert result == "Link1 and Link2 and Link3"
        assert "url" not in result

    def test_no_links(self, converter):
        """Plain text without links is unchanged."""
        text = "This is plain text with no links."
        result = converter._strip_hidden_links(text)
        assert result == text

    def test_empty_link_text(self, converter):
        """Link with empty display text becomes empty."""
        text = "Before [](url) after"
        result = converter._strip_hidden_links(text)
        assert result == "Before  after"

    def test_link_at_start(self, converter):
        """Link at start of text is handled."""
        text = "[Start](url) of the text"
        result = converter._strip_hidden_links(text)
        assert result == "Start of the text"

    def test_link_at_end(self, converter):
        """Link at end of text is handled."""
        text = "End of the [text](url)"
        result = converter._strip_hidden_links(text)
        assert result == "End of the text"

    def test_link_spans_newline(self, converter):
        """Link text doesn't span newlines (regex behavior)."""
        text = "A [link](url) here\nAnother [link2](url2) there"
        result = converter._strip_hidden_links(text)
        assert result == "A link here\nAnother link2 there"

    def test_preserves_non_link_brackets(self, converter):
        """Non-link brackets are preserved."""
        text = "Array [0] and function(args)"
        result = converter._strip_hidden_links(text)
        assert result == text

    def test_url_with_parens(self, converter):
        """URL containing parentheses (edge case)."""
        # Note: This tests current behavior - URL parens may break matching
        text = "[Wiki](https://en.wikipedia.org/wiki/Test_(thing))"
        result = converter._strip_hidden_links(text)
        # Current regex stops at first ), leaving partial URL
        # This documents existing behavior
        assert "Wiki" in result
