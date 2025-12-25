# apps/ai-worker/src/converters/epub_converter.py
"""EPUB converter using ebooklib."""

from pathlib import Path
from typing import List

import ebooklib
from bs4 import BeautifulSoup
from ebooklib import epub

from src.logging_config import get_logger
from src.models import ProcessorOutput
from src.sanitizer import InputSanitizer

from .base import FormatConverter

logger = get_logger(__name__)


class EpubConverter(FormatConverter):
    """
    Converts EPUB files to Markdown.
    Extracts chapters and converts HTML content.
    """

    category = "document"
    SKIP_ITEMS = {"toc", "nav", "cover", "ncx", "copyright", "title"}

    def __init__(self):
        self.sanitizer = InputSanitizer()

    async def to_markdown(self, file_path: str) -> ProcessorOutput:
        """Convert EPUB to Markdown."""
        try:
            path = Path(file_path)
            if not path.exists():
                return ProcessorOutput(
                    markdown="", metadata={"error": f"File not found: {file_path}"}
                )

            book = epub.read_epub(str(path))
            chapters: List[str] = []

            # Extract book title from metadata
            book_title = book.get_metadata("DC", "title")
            book_title = book_title[0][0] if book_title else None

            for item in book.get_items():
                if item.get_type() != ebooklib.ITEM_DOCUMENT:
                    continue

                item_name = (item.get_name() or "").lower()
                if any(skip in item_name for skip in self.SKIP_ITEMS):
                    continue

                content = item.get_content().decode("utf-8", errors="replace")
                soup = BeautifulSoup(content, "lxml")

                # Extract title from first heading
                title = None
                for tag in ["h1", "h2", "h3"]:
                    heading = soup.find(tag)
                    if heading:
                        title = heading.get_text(strip=True)
                        break

                # Get body text
                body = soup.body or soup
                text = body.get_text(separator="\n", strip=True)
                text = self.sanitizer.sanitize(text)

                if not text.strip():
                    continue

                # Format chapter
                if title:
                    chapter_md = f"# {title}\n\n{text}"
                else:
                    chapter_md = text

                chapters.append(chapter_md)

            if not chapters:
                return ProcessorOutput(
                    markdown="", metadata={"error": "No content found"}
                )

            markdown = "\n\n---\n\n".join(chapters)

            logger.info(
                "epub_conversion_complete",
                path=file_path,
                chapters=len(chapters),
            )

            metadata = {"chapter_count": len(chapters)}
            if book_title:
                metadata["title"] = book_title

            return ProcessorOutput(
                markdown=markdown,
                metadata=metadata,
                chapter_count=len(chapters),
            )

        except Exception as e:
            logger.exception("epub_conversion_error", path=file_path, error=str(e))
            return ProcessorOutput(markdown="", metadata={"error": str(e)})
