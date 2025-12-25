# apps/ai-worker/tests/test_normalizer.py
"""
Unit tests for MarkdownNormalizer module.
Tests markdown cleanup: blank lines, bullets, headings, code blocks.
"""

import pytest

from src.normalizer import MarkdownNormalizer


@pytest.fixture
def normalizer():
    """Create MarkdownNormalizer instance."""
    return MarkdownNormalizer()


class TestMarkdownNormalizer:
    """Tests for MarkdownNormalizer.normalize() method."""

    def test_normalize_heading_gaps(self, normalizer):
        """Headings have proper spacing (1 blank line before, none after)."""
        text = "Some text\n\n\n\n# Heading\n\n\nMore text"
        result = normalizer.normalize(text)
        # Should have exactly 2 newlines before heading (1 blank line)
        # and 1 newline after heading (no blank line)
        assert "\n\n\n# Heading" not in result
        assert "# Heading\n\n\n" not in result
        assert "# Heading\n\nMore text" in result

    def test_remove_empty_sections(self, normalizer):
        """Headings with no content are removed."""
        text = "# Section 1\n\nContent here.\n\n# Empty Section\n\n# Section 2\n\nMore content."
        result = normalizer.normalize(text)
        # Empty Section (heading followed by another heading) should be removed
        assert "# Empty Section" not in result
        assert "# Section 1" in result
        assert "# Section 2" in result

    def test_collapse_blank_lines(self, normalizer):
        """Multiple blank lines collapse to max 2 (1 blank line)."""
        text = "Line1\n\n\n\n\nLine2"
        result = normalizer.normalize(text)
        # Max 2 consecutive newlines
        assert "\n\n\n" not in result
        assert "Line1\n\nLine2" in result

    def test_standardize_bullets(self, normalizer):
        """Bullets *, + are converted to -."""
        text = "List:\n* Item 1\n+ Item 2\n- Item 3"
        result = normalizer.normalize(text)
        assert "* Item" not in result
        assert "+ Item" not in result
        assert "- Item 1" in result
        assert "- Item 2" in result
        assert "- Item 3" in result

    def test_preserve_code_blocks(self, normalizer):
        """Code block content is not modified."""
        text = """Some text
```python
* This is code
+ Not a bullet
def foo():   
    pass
```
End text"""
        result = normalizer.normalize(text)
        # Inside code block, * and + should NOT be converted
        assert "* This is code" in result
        assert "+ Not a bullet" in result

    def test_fix_unclosed_code_blocks(self, normalizer):
        """Unclosed code blocks are automatically closed."""
        text = "Some text\n```python\ncode here\nmore code"
        result = normalizer.normalize(text)
        # Should have closing fence
        assert result.count("```") == 2
        assert result.endswith("```") or "```\n" in result

    def test_empty_string(self, normalizer):
        """Empty string returns empty string."""
        result = normalizer.normalize("")
        assert result == ""

    def test_nested_lists(self, normalizer):
        """Nested bullets are also standardized."""
        text = "* Item 1\n  * Nested 1\n  + Nested 2\n    * Deep nested"
        result = normalizer.normalize(text)
        assert "* " not in result
        assert "+ " not in result
        assert "- Item 1" in result
        assert "  - Nested 1" in result
        assert "  - Nested 2" in result
        assert "    - Deep nested" in result

    def test_mixed_heading_levels(self, normalizer):
        """Different heading levels are handled correctly."""
        text = "# H1\n\n## H2\n\n### H3\n\nContent"
        result = normalizer.normalize(text)
        assert "# H1" in result
        assert "## H2" in result
        assert "### H3" in result

    def test_code_blocks_with_info_string(self, normalizer):
        """Code blocks with language info string are preserved."""
        text = "```javascript\nconst x = 1;\n```"
        result = normalizer.normalize(text)
        assert "```javascript" in result
        assert "const x = 1;" in result
        assert result.count("```") == 2

    def test_multiple_code_blocks(self, normalizer):
        """Multiple code blocks are all preserved."""
        text = """First:
```python
code1
```

Second:
```bash
code2
```"""
        result = normalizer.normalize(text)
        assert "```python" in result
        assert "```bash" in result
        assert result.count("```") == 4

    def test_bullets_not_in_words(self, normalizer):
        """Stars and plus in the middle of text are not converted."""
        text = "This is 2*3+4 math\nAnd a*b+c algebra"
        result = normalizer.normalize(text)
        # These are not bullets, should not change
        assert "2*3+4" in result
        assert "a*b+c" in result
