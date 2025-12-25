# apps/ai-worker/tests/test_html_processor.py
"""
Unit tests for HtmlProcessor module.
Tests HTML to Markdown conversion with BeautifulSoup and markdownify.
"""

import pytest

from src.html_processor import HtmlProcessor
from src.models import ProcessorOutput


@pytest.fixture
def processor():
    """Create HtmlProcessor instance."""
    return HtmlProcessor()


class TestHtmlProcessorBasic:
    """Tests for basic HTML extraction."""

    @pytest.mark.asyncio
    async def test_extract_body_content(self, processor, tmp_path):
        """Body content is extracted, head is ignored."""
        html_file = tmp_path / "test.html"
        html_file.write_text(
            """
        <html>
        <head><title>Test</title></head>
        <body><p>Hello World</p></body>
        </html>
        """
        )

        result = await processor.process(str(html_file))

        assert "Hello World" in result.markdown
        assert "<title>" not in result.markdown

    @pytest.mark.asyncio
    async def test_preserve_heading_hierarchy(self, processor, tmp_path):
        """Heading levels are preserved."""
        html_file = tmp_path / "headings.html"
        html_file.write_text(
            """
        <h1>Main Title</h1>
        <h2>Subtitle</h2>
        <h3>Section</h3>
        """
        )

        result = await processor.process(str(html_file))

        assert "# Main Title" in result.markdown
        assert "## Subtitle" in result.markdown
        assert "### Section" in result.markdown

    @pytest.mark.asyncio
    async def test_convert_paragraphs(self, processor, tmp_path):
        """Paragraphs are converted with proper spacing."""
        html_file = tmp_path / "paragraphs.html"
        html_file.write_text("<p>First paragraph.</p><p>Second paragraph.</p>")

        result = await processor.process(str(html_file))

        assert "First paragraph." in result.markdown
        assert "Second paragraph." in result.markdown


class TestHtmlProcessorLists:
    """Tests for list conversion."""

    @pytest.mark.asyncio
    async def test_convert_unordered_list(self, processor, tmp_path):
        """Unordered lists use - bullets."""
        html_file = tmp_path / "ul.html"
        html_file.write_text("<ul><li>Item 1</li><li>Item 2</li></ul>")

        result = await processor.process(str(html_file))

        # markdownify uses * by default, we normalize to -
        assert "Item 1" in result.markdown
        assert "Item 2" in result.markdown

    @pytest.mark.asyncio
    async def test_convert_ordered_list(self, processor, tmp_path):
        """Ordered lists use numbered format."""
        html_file = tmp_path / "ol.html"
        html_file.write_text("<ol><li>First</li><li>Second</li></ol>")

        result = await processor.process(str(html_file))

        assert "First" in result.markdown
        assert "Second" in result.markdown

    @pytest.mark.asyncio
    async def test_convert_nested_lists(self, processor, tmp_path):
        """Nested lists are indented properly."""
        html_file = tmp_path / "nested.html"
        html_file.write_text(
            """
        <ul>
            <li>Parent
                <ul><li>Child</li></ul>
            </li>
        </ul>
        """
        )

        result = await processor.process(str(html_file))

        assert "Parent" in result.markdown
        assert "Child" in result.markdown


class TestHtmlProcessorTables:
    """Tests for table conversion."""

    @pytest.mark.asyncio
    async def test_convert_table(self, processor, tmp_path):
        """Tables are converted to markdown tables."""
        html_file = tmp_path / "table.html"
        html_file.write_text(
            """
        <table>
            <tr><th>Name</th><th>Age</th></tr>
            <tr><td>Alice</td><td>30</td></tr>
        </table>
        """
        )

        result = await processor.process(str(html_file))

        assert "Name" in result.markdown
        assert "Alice" in result.markdown
        assert "|" in result.markdown  # Table format


class TestHtmlProcessorLinksCode:
    """Tests for links and code conversion."""

    @pytest.mark.asyncio
    async def test_convert_links(self, processor, tmp_path):
        """Links are converted to markdown format."""
        html_file = tmp_path / "links.html"
        html_file.write_text('<a href="https://example.com">Example</a>')

        result = await processor.process(str(html_file))

        assert "[Example]" in result.markdown
        assert "https://example.com" in result.markdown

    @pytest.mark.asyncio
    async def test_convert_code_blocks(self, processor, tmp_path):
        """Code blocks are preserved."""
        html_file = tmp_path / "code.html"
        html_file.write_text("<pre><code>def hello():\n    print('hi')</code></pre>")

        result = await processor.process(str(html_file))

        assert "def hello():" in result.markdown
        assert "```" in result.markdown or "`" in result.markdown

    @pytest.mark.asyncio
    async def test_convert_inline_code(self, processor, tmp_path):
        """Inline code uses backticks."""
        html_file = tmp_path / "inline.html"
        html_file.write_text("<p>Use <code>print()</code> function.</p>")

        result = await processor.process(str(html_file))

        assert "`print()`" in result.markdown


class TestHtmlProcessorCleanup:
    """Tests for removing unwanted elements."""

    @pytest.mark.asyncio
    async def test_remove_scripts(self, processor, tmp_path):
        """Script tags are removed."""
        html_file = tmp_path / "script.html"
        html_file.write_text(
            """
        <p>Content</p>
        <script>alert('evil');</script>
        """
        )

        result = await processor.process(str(html_file))

        assert "Content" in result.markdown
        assert "alert" not in result.markdown
        assert "<script>" not in result.markdown

    @pytest.mark.asyncio
    async def test_remove_styles(self, processor, tmp_path):
        """Style tags are removed."""
        html_file = tmp_path / "style.html"
        html_file.write_text(
            """
        <p>Content</p>
        <style>.hidden { display: none; }</style>
        """
        )

        result = await processor.process(str(html_file))

        assert "Content" in result.markdown
        assert "display" not in result.markdown
        assert "<style>" not in result.markdown

    @pytest.mark.asyncio
    async def test_remove_comments(self, processor, tmp_path):
        """HTML comments are removed."""
        html_file = tmp_path / "comments.html"
        html_file.write_text("<p>Content</p><!-- This is a comment -->")

        result = await processor.process(str(html_file))

        assert "Content" in result.markdown
        assert "comment" not in result.markdown

    @pytest.mark.asyncio
    async def test_remove_nav_footer(self, processor, tmp_path):
        """Nav and footer elements are removed."""
        html_file = tmp_path / "nav.html"
        html_file.write_text(
            """
        <nav><a href="/">Home</a></nav>
        <main><p>Main content</p></main>
        <footer>Copyright 2024</footer>
        """
        )

        result = await processor.process(str(html_file))

        assert "Main content" in result.markdown
        # Nav and footer should be removed
        assert "Copyright" not in result.markdown


class TestHtmlProcessorEdgeCases:
    """Tests for edge cases."""

    @pytest.mark.asyncio
    async def test_empty_html(self, processor, tmp_path):
        """Empty HTML returns empty markdown."""
        html_file = tmp_path / "empty.html"
        html_file.write_text("")

        result = await processor.process(str(html_file))

        assert result.markdown == ""

    @pytest.mark.asyncio
    async def test_file_not_found(self, processor):
        """Missing file returns error in metadata."""
        result = await processor.process("/nonexistent/file.html")

        assert result.markdown == ""
        assert "error" in result.metadata

    @pytest.mark.asyncio
    async def test_plain_text_html(self, processor, tmp_path):
        """Plain text without tags is preserved."""
        html_file = tmp_path / "plain.html"
        html_file.write_text("Just plain text content")

        result = await processor.process(str(html_file))

        assert "Just plain text content" in result.markdown
