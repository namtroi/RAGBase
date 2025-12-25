# apps/ai-worker/src/epub_processor.py
"""
EPUB Processor for converting EPUB files to Markdown.
Uses ebooklib for reading and BeautifulSoup for HTML parsing.
"""

from pathlib import Path
from typing import Any, Dict, List

from bs4 import BeautifulSoup
from ebooklib import epub, ITEM_DOCUMENT
import markdownify

from src.models import ProcessorOutput
from src.sanitizer import InputSanitizer
from src.normalizer import MarkdownNormalizer


class EpubProcessor:
    """
    Processes EPUB files to Markdown format.
    Extracts chapters, skips TOC/cover/nav items.
    Separates chapters with horizontal rules.
    """

    # Patterns to identify items to skip
    SKIP_PATTERNS = [
        "toc",
        "nav",
        "cover",
        "title",
        "copyright",
        "frontmatter",
        "backmatter",
        "index",
    ]

    def __init__(self):
        self.sanitizer = InputSanitizer()
        self.normalizer = MarkdownNormalizer()

    async def process(self, file_path: str) -> ProcessorOutput:
        """
        Process an EPUB file to Markdown.

        Args:
            file_path: Path to the EPUB file

        Returns:
            ProcessorOutput with markdown content and metadata
        """
        try:
            path = Path(file_path)
            if not path.exists():
                return ProcessorOutput(
                    markdown="", metadata={"error": f"File not found: {file_path}"}
                )

            # Read EPUB
            book = epub.read_epub(str(path))

            # Extract chapters
            chapters = self._extract_chapters(book)

            if not chapters:
                return ProcessorOutput(markdown="", metadata={}, chapter_count=0)

            # Convert chapters to markdown
            markdown_chapters: List[str] = []
            for chapter in chapters:
                md = self._chapter_to_markdown(chapter)
                if md.strip():
                    markdown_chapters.append(md)

            # Join with horizontal rules
            markdown = "\n\n---\n\n".join(markdown_chapters)

            # Sanitize and normalize
            markdown = self.sanitizer.sanitize(markdown)
            markdown = self.normalizer.normalize(markdown)

            # Build metadata
            metadata: Dict[str, Any] = {
                "title": self._get_title(book),
                "author": self._get_author(book),
            }

            return ProcessorOutput(
                markdown=markdown,
                metadata=metadata,
                chapter_count=len(markdown_chapters),
            )

        except Exception as e:
            return ProcessorOutput(markdown="", metadata={"error": str(e)})

    def _extract_chapters(self, book: epub.EpubBook) -> List[epub.EpubHtml]:
        """Extract content chapters, skipping TOC/cover/nav."""
        chapters = []

        for item in book.get_items_of_type(ITEM_DOCUMENT):
            # Skip navigation and other non-content items
            if self._should_skip(item):
                continue

            chapters.append(item)

        return chapters

    def _should_skip(self, item: epub.EpubHtml) -> bool:
        """Check if item should be skipped (TOC, cover, nav, etc)."""
        # Check filename
        filename = item.get_name().lower()
        for pattern in self.SKIP_PATTERNS:
            if pattern in filename:
                return True

        # Check if it's a navigation item
        if hasattr(item, "is_chapter") and not item.is_chapter():
            return True

        return False

    def _chapter_to_markdown(self, chapter: epub.EpubHtml) -> str:
        """Convert chapter HTML content to markdown."""
        content = chapter.get_content()

        # Decode if bytes
        if isinstance(content, bytes):
            content = content.decode("utf-8", errors="replace")

        # Parse HTML
        soup = BeautifulSoup(content, "lxml")

        # Get body content
        body = soup.find("body")
        if body:
            html_content = str(body)
        else:
            html_content = str(soup)

        # Convert to markdown
        markdown = markdownify.markdownify(
            html_content,
            heading_style="ATX",
            bullets="-",
        )

        return markdown.strip()

    def _get_title(self, book: epub.EpubBook) -> str:
        """Extract book title from metadata."""
        title = book.get_metadata("DC", "title")
        if title:
            return title[0][0] if isinstance(title[0], tuple) else str(title[0])
        return ""

    def _get_author(self, book: epub.EpubBook) -> str:
        """Extract author from metadata."""
        creator = book.get_metadata("DC", "creator")
        if creator:
            return creator[0][0] if isinstance(creator[0], tuple) else str(creator[0])
        return ""
