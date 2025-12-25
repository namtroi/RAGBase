# apps/ai-worker/src/html_processor.py
"""
HTML Processor for converting HTML files to Markdown.
Uses BeautifulSoup for parsing and markdownify for conversion.
"""

from pathlib import Path
from typing import Any, Dict

from bs4 import BeautifulSoup, Comment
import markdownify

from src.models import ProcessorOutput
from src.sanitizer import InputSanitizer
from src.normalizer import MarkdownNormalizer


class HtmlProcessor:
    """
    Processes HTML files to Markdown format.
    Removes unwanted elements (scripts, styles, nav, footer).
    Preserves semantic structure (headings, lists, tables).
    """

    # Elements to remove completely
    REMOVE_TAGS = ["script", "style", "nav", "footer", "aside", "noscript", "iframe"]

    def __init__(self):
        self.sanitizer = InputSanitizer()
        self.normalizer = MarkdownNormalizer()

    async def process(self, file_path: str) -> ProcessorOutput:
        """
        Process an HTML file to Markdown.

        Args:
            file_path: Path to the HTML file

        Returns:
            ProcessorOutput with markdown content and metadata
        """
        try:
            path = Path(file_path)
            if not path.exists():
                return ProcessorOutput(
                    markdown="", metadata={"error": f"File not found: {file_path}"}
                )

            # Read file content
            content = path.read_text(encoding="utf-8", errors="replace")

            if not content.strip():
                return ProcessorOutput(markdown="", metadata={})

            # Parse HTML
            soup = BeautifulSoup(content, "lxml")

            # Remove unwanted elements
            self._remove_unwanted(soup)

            # Convert to markdown
            markdown = self._to_markdown(soup)

            # Sanitize and normalize
            markdown = self.sanitizer.sanitize(markdown)
            markdown = self.normalizer.normalize(markdown)

            # Clean up excessive whitespace
            markdown = self._clean_whitespace(markdown)

            # Build metadata
            metadata: Dict[str, Any] = {
                "title": self._extract_title(soup),
            }

            return ProcessorOutput(markdown=markdown, metadata=metadata)

        except Exception as e:
            return ProcessorOutput(markdown="", metadata={"error": str(e)})

    def _remove_unwanted(self, soup: BeautifulSoup) -> None:
        """Remove unwanted elements from the soup."""
        # Remove specified tags
        for tag in self.REMOVE_TAGS:
            for element in soup.find_all(tag):
                element.decompose()

        # Remove HTML comments
        for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
            comment.extract()

    def _to_markdown(self, soup: BeautifulSoup) -> str:
        """Convert BeautifulSoup to markdown."""
        # Get body content if exists, otherwise use whole document
        body = soup.find("body")
        if body:
            html_content = str(body)
        else:
            html_content = str(soup)

        # Convert to markdown using markdownify
        markdown = markdownify.markdownify(
            html_content,
            heading_style="ATX",  # Use # style headings
            bullets="-",  # Use - for unordered lists
            code_language="",  # Don't add language to code blocks
            strip=["a"] if not html_content else None,  # Keep links
        )

        return markdown

    def _extract_title(self, soup: BeautifulSoup) -> str:
        """Extract page title from HTML."""
        title_tag = soup.find("title")
        if title_tag:
            return title_tag.get_text(strip=True)

        # Fallback to first h1
        h1_tag = soup.find("h1")
        if h1_tag:
            return h1_tag.get_text(strip=True)

        return ""

    def _clean_whitespace(self, text: str) -> str:
        """Clean up excessive whitespace while preserving structure."""
        lines = text.split("\n")

        # Remove trailing whitespace from each line
        lines = [line.rstrip() for line in lines]

        # Collapse multiple blank lines to max 2
        result = []
        blank_count = 0
        for line in lines:
            if line == "":
                blank_count += 1
                if blank_count <= 2:
                    result.append(line)
            else:
                blank_count = 0
                result.append(line)

        return "\n".join(result).strip()
