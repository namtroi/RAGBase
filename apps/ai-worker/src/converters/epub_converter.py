# apps/ai-worker/src/converters/epub_converter.py
"""EPUB converter using ebooklib and BeautifulSoup."""

from pathlib import Path
from typing import Any, Dict, List, Optional

import ebooklib
from bs4 import BeautifulSoup, NavigableString, Tag
from ebooklib import epub

from src.logging_config import get_logger
from src.models import ProcessorOutput

from .base import FormatConverter

logger = get_logger(__name__)


class EpubConverter(FormatConverter):
    """
    Converts EPUB files to Markdown.
    Crucial for Phase 4: Preserves Heading structure (#, ##) for header-based chunking.
    """

    category = "document"
    # Skip standard non-content files
    SKIP_ITEMS = {"toc", "nav", "cover", "ncx", "copyright", "title", "license"}

    async def to_markdown(self, file_path: str) -> ProcessorOutput:
        """Convert EPUB to Markdown preserving structure."""
        try:
            path = Path(file_path)
            if not path.exists():
                return ProcessorOutput(
                    markdown="", metadata={"error": f"File not found: {file_path}"}
                )

            # Ebooklib can be chatty, suppress warnings if needed
            book = epub.read_epub(str(path))
            chapters: List[str] = []

            # Extract book metadata
            book_title = self._get_metadata(book, "title")
            author = self._get_metadata(book, "creator")

            # Iterate through items (Phase 4: Split by chapter markers)
            for item in book.get_items():
                if item.get_type() != ebooklib.ITEM_DOCUMENT:
                    continue

                # Filter out utility files based on name
                item_name = (item.get_name() or "").lower()
                if any(skip in item_name for skip in self.SKIP_ITEMS):
                    continue

                content = item.get_content().decode("utf-8", errors="replace")

                # Convert HTML content to Markdown
                # This ensures H1/H2 tags become #/## for the splitter
                chapter_md = self._html_to_markdown(content)

                # Sanitize using base logic (Phase 4: Input Sanitization)
                chapter_md = self._sanitize_raw(chapter_md)

                if not chapter_md.strip():
                    continue

                chapters.append(chapter_md)

            if not chapters:
                return ProcessorOutput(
                    markdown="", metadata={"error": "No content found in EPUB"}
                )

            # Join chapters with horizontal rules to denote explicit breaks
            full_markdown = "\n\n---\n\n".join(chapters)

            # Final normalization
            full_markdown = self._post_process(full_markdown)

            metadata: Dict[str, Any] = {
                "chapter_count": len(chapters),
                "title": book_title,
                "author": author,
                "source_format": "epub",
            }

            return ProcessorOutput(markdown=full_markdown, metadata=metadata)

        except Exception as e:
            logger.exception("epub_conversion_error", path=file_path, error=str(e))
            return ProcessorOutput(markdown="", metadata={"error": str(e)})

    def _get_metadata(self, book: epub.EpubBook, key: str) -> Optional[str]:
        try:
            data = book.get_metadata("DC", key)
            if data and len(data) > 0:
                return data[0][0]
        except Exception:
            pass
        return None

    def _html_to_markdown(self, html_content: str) -> str:
        """
        Parses HTML and converts semantic tags to Markdown.
        We do this manually to avoid extra dependencies (like markdownify)
        and to strictly control the output for RAG optimization.
        """
        soup = BeautifulSoup(html_content, "lxml")

        # Remove script and style elements
        for script in soup(["script", "style", "meta", "link", "noscript"]):
            script.decompose()

        # Focus on body, or full soup if no body
        root = soup.body or soup

        # Recursive function to process tags
        def process_element(element):
            if isinstance(element, NavigableString):
                text = str(element).strip()
                if text:
                    return text
                return ""

            if isinstance(element, Tag):
                content = ""

                # Process children first
                for child in element.children:
                    child_md = process_element(child)
                    if child_md:
                        # Add space between inline elements if needed
                        if (
                            content
                            and not content.endswith(" ")
                            and not child_md.startswith(" ")
                        ):
                            content += " " + child_md
                        else:
                            content += child_md

                content = content.strip()
                if not content:
                    return ""

                # Block-level transformations
                if element.name in ["h1"]:
                    return f"\n\n# {content}\n\n"
                elif element.name in ["h2"]:
                    return f"\n\n## {content}\n\n"
                elif element.name in ["h3"]:
                    return f"\n\n### {content}\n\n"
                elif element.name in ["h4", "h5", "h6"]:
                    return f"\n\n#### {content}\n\n"
                elif element.name == "p":
                    return f"\n\n{content}\n\n"
                elif element.name == "br":
                    return "\n"
                elif element.name == "li":
                    return f"\n- {content}"
                elif element.name in ["ul", "ol"]:
                    return f"\n{content}\n"
                elif element.name == "blockquote":
                    return f"\n> {content}\n"
                elif element.name == "pre":
                    return f"\n```\n{content}\n```\n"

                # Inline transformations
                elif element.name in ["b", "strong"]:
                    return f"**{content}**"
                elif element.name in ["i", "em"]:
                    return f"*{content}*"
                elif element.name == "code":
                    return f"`{content}`"
                elif element.name == "a":
                    href = element.get("href", "")
                    return f"[{content}]({href})" if href else content

                # Table handling (simple text extraction for now, usually complex in EPUB)
                elif element.name in ["tr"]:
                    return f"\n{content}"
                elif element.name in ["td", "th"]:
                    return f" {content} |"

                # Return content as-is for divs, spans, etc.
                return content

            return ""

        # Process the root
        return process_element(root)
