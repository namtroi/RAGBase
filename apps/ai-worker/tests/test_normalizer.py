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


class TestRemovePageArtifacts:
    """Tests for MarkdownNormalizer.remove_page_artifacts()"""

    def test_remove_standalone_number(self, normalizer):
        """Isolated numbers 1-999 are removed."""
        text = "Content here.\n\n3\n\nMore content."
        result = normalizer.remove_page_artifacts(text)
        assert "3" not in result
        assert "Content here." in result
        assert "More content." in result

    def test_remove_page_prefix(self, normalizer):
        """'page X' and 'Page X' patterns are removed."""
        text = "Content.\n\npage 12\n\nMore."
        result = normalizer.remove_page_artifacts(text)
        assert "page 12" not in result

        text2 = "Content.\n\nPage 5\n\nMore."
        result2 = normalizer.remove_page_artifacts(text2)
        assert "Page 5" not in result2

    def test_remove_dashed_number(self, normalizer):
        """'- X -' format is removed."""
        text = "Content.\n\n- 5 -\n\nMore."
        result = normalizer.remove_page_artifacts(text)
        assert "- 5 -" not in result

    def test_preserve_number_in_paragraph(self, normalizer):
        """Numbers within text are preserved."""
        text = "The answer is 3.\n\nNext paragraph."
        result = normalizer.remove_page_artifacts(text)
        assert "The answer is 3." in result

    def test_preserve_multiline_paragraph(self, normalizer):
        """Numbers in multi-line paragraphs are preserved."""
        text = "Line1\n3\nLine3\n\nNext."
        result = normalizer.remove_page_artifacts(text)
        assert "3" in result

    def test_preserve_four_digit_numbers(self, normalizer):
        """4-digit numbers (e.g., years) are preserved."""
        text = "Content.\n\n2024\n\nMore."
        result = normalizer.remove_page_artifacts(text)
        assert "2024" in result

    def test_empty_string(self, normalizer):
        """Empty string returns empty string."""
        result = normalizer.remove_page_artifacts("")
        assert result == ""

    def test_remove_with_whitespace(self, normalizer):
        """Page numbers with leading/trailing whitespace are removed."""
        text = "Content.\n\n                                            1\n\nMore."
        result = normalizer.remove_page_artifacts(text)
        assert "1" not in result
        assert "Content." in result
        assert "More." in result


class TestRemoveJunkCodeBlocks:
    """Tests for MarkdownNormalizer.remove_junk_code_blocks()"""

    def test_remove_empty_code_block(self, normalizer):
        """Empty code blocks are removed."""
        text = "Content.\n\n```\n\n```\n\nMore."
        result = normalizer.remove_junk_code_blocks(text)
        assert "```" not in result
        assert "Content." in result
        assert "More." in result

    def test_remove_code_block_with_page_number(self, normalizer):
        """Code blocks with only page number are removed."""
        text = "Content.\n\n```\n|         |         1\n```\n\nMore."
        result = normalizer.remove_junk_code_blocks(text)
        assert "```" not in result

    def test_remove_code_block_with_whitespace_page(self, normalizer):
        """Code blocks with whitespace and page number are removed."""
        text = "Content.\n\n```\n                                            1\n```\n\nMore."
        result = normalizer.remove_junk_code_blocks(text)
        assert "```" not in result

    def test_preserve_real_code_block(self, normalizer):
        """Code blocks with actual code are preserved."""
        text = "```python\ndef foo():\n    return 1\n```"
        result = normalizer.remove_junk_code_blocks(text)
        assert "def foo():" in result
        assert "```python" in result

    def test_empty_string(self, normalizer):
        """Empty string returns empty string."""
        result = normalizer.remove_junk_code_blocks("")
        assert result == ""


class TestMergeSoftLinebreaks:
    """Tests for MarkdownNormalizer.merge_soft_linebreaks()"""

    def test_merge_lowercase_continuation(self, normalizer):
        """Single newline before lowercase merges."""
        text = "individuals and teams who\nmade this book possible."
        result = normalizer.merge_soft_linebreaks(text)
        assert result == "individuals and teams who made this book possible."

    def test_keep_capital_next_line(self, normalizer):
        """Capital start = new item/sentence, keep newline."""
        text = "Dedication, 1 page\nAcknowledgment, 2 pages"
        result = normalizer.merge_soft_linebreaks(text)
        assert "page\nAcknowledgment" in result

    def test_keep_bracket_ending(self, normalizer):
        """Closing bracket = complete unit, keep newline."""
        text = "Foreword [final, last read done]\nIntroduction, 4 pages"
        result = normalizer.merge_soft_linebreaks(text)
        assert "done]\nIntroduction" in result

    def test_keep_paren_ending(self, normalizer):
        """Closing paren = complete unit, keep newline."""
        text = "Chapter 1 (code)\nChapter 2 (code)"
        result = normalizer.merge_soft_linebreaks(text)
        assert "code)\nChapter" in result

    def test_merge_comma_lowercase(self, normalizer):
        """Comma + lowercase = merge."""
        text = "empowering Googlers,\nand respecting"
        result = normalizer.merge_soft_linebreaks(text)
        assert result == "empowering Googlers, and respecting"

    def test_preserve_headings(self, normalizer):
        """Don't merge into heading lines."""
        text = "some text\n# Heading"
        result = normalizer.merge_soft_linebreaks(text)
        assert "text\n# Heading" in result

    def test_preserve_list_items(self, normalizer):
        """Don't merge into list items."""
        text = "some text\n- item one"
        result = normalizer.merge_soft_linebreaks(text)
        assert "text\n- item" in result

    def test_preserve_blockquotes(self, normalizer):
        """Don't merge into blockquotes."""
        text = "some text\n> quote"
        result = normalizer.merge_soft_linebreaks(text)
        assert "text\n> quote" in result

    def test_preserve_tables(self, normalizer):
        """Don't merge into table rows."""
        text = "some text\n| col1 | col2 |"
        result = normalizer.merge_soft_linebreaks(text)
        assert "text\n| col1" in result

    def test_preserve_code_blocks(self, normalizer):
        """Code blocks are not modified."""
        text = "```python\ndef foo():\n    pass\n```"
        result = normalizer.merge_soft_linebreaks(text)
        assert "def foo():\n    pass" in result

    def test_preserve_real_paragraph_breaks(self, normalizer):
        """Real paragraph breaks (sentence end + capital) are preserved."""
        text = "Sentence ends here.\n\nNew paragraph starts here."
        result = normalizer.merge_soft_linebreaks(text)
        assert "\n\n" in result
        assert "here.\n\nNew" in result

    def test_empty_string(self, normalizer):
        """Empty string returns empty string."""
        result = normalizer.merge_soft_linebreaks("")
        assert result == ""

    def test_toc_pattern_preserved(self, normalizer):
        """Table of Contents entries stay on separate lines."""
        text = (
            "Dedication, 1 page\n"
            "Acknowledgment, 2 pages\n"
            "Foreword, 1 page [final]\n"
            "Introduction, 4 pages"
        )
        result = normalizer.merge_soft_linebreaks(text)
        # All should stay separate (capitals + brackets)
        assert "page\nAcknowledgment" in result
        assert "pages\nForeword" in result
        assert "final]\nIntroduction" in result

    def test_merge_fake_paragraph_break(self, normalizer):
        """PDF artifact: empty line between mid-sentence and lowercase is merged."""
        text = "Routing enables agents to make dynamic decisions about the next step in a\n\nworkflow based on conditions."
        result = normalizer.merge_soft_linebreaks(text)
        assert "step in a workflow" in result
        assert "\n\n" not in result

    def test_merge_bullet_with_fake_break(self, normalizer):
        """Bullet points with PDF artifact breaks are merged correctly."""
        text = (
            "● Routing enables agents to make dynamic decisions about the next step in a\n\n"
            "workflow based on conditions.\n"
            "● It allows agents to handle diverse inputs and adapt their behavior, moving beyond\n\n"
            "linear execution."
        )
        result = normalizer.merge_soft_linebreaks(text)
        assert "step in a workflow" in result
        assert "beyond linear" in result

    def test_keep_paragraph_after_sentence(self, normalizer):
        """Real paragraph break after sentence punct + capital is kept."""
        text = "This is a complete sentence.\n\nThis starts a new paragraph."
        result = normalizer.merge_soft_linebreaks(text)
        assert "sentence.\n\nThis" in result

    def test_keep_paragraph_after_bracket(self, normalizer):
        """Paragraph break after bracket is kept even with lowercase next."""
        text = "Item [final]\n\nsome lowercase text"
        result = normalizer.merge_soft_linebreaks(text)
        assert "]\n\n" in result

    def test_real_world_pdf_sample(self, normalizer):
        """Test with real PDF acknowledgment text pattern."""
        text = (
            "I would like to express my sincere gratitude to the many individuals and teams who\n"
            "made this book possible.\n"
            "First and foremost, I thank Google for adhering to its mission, empowering Googlers,\n"
            "and respecting the opportunity to innovate."
        )
        result = normalizer.merge_soft_linebreaks(text)
        # Should merge within sentences (lowercase continuations)
        assert "teams who made" in result
        assert "Googlers, and respecting" in result
        # Should keep sentence boundaries (capital after period)
        assert "possible.\nFirst" in result
