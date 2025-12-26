# apps/ai-worker/src/converters/html_converter.py
"""HTML converter using BeautifulSoup."""

from pathlib import Path
from typing import Any, Dict, List, Optional

from bs4 import BeautifulSoup, NavigableString, Tag, Comment

from src.logging_config import get_logger
from src.models import ProcessorOutput

from .base import FormatConverter

logger = get_logger(__name__)


class HtmlConverter(FormatConverter):
    """
    Converts HTML files to Markdown.

    Phase 4 Improvements:
    - Removes dependence on 'markdownify' (aligns with Roadmap dependencies).
    - Extracts Metadata (Title, Description).
    - Respects semantic tags (<section>, <article>) for better chunking.
    """

    category = "document"
    # Tags to strictly remove
    REMOVE_TAGS: List[str] = [
        "script",
        "style",
        "nav",
        "footer",
        "aside",
        "noscript",
        "iframe",
        "svg",
        "header",  # Often contains site-wide nav, safe to remove for RAG focus
    ]

    async def to_markdown(self, file_path: str) -> ProcessorOutput:
        """Convert HTML to Markdown using custom recursive parser."""
        try:
            path = Path(file_path)
            if not path.exists():
                return ProcessorOutput(
                    markdown="", metadata={"error": f"File not found: {file_path}"}
                )

            # Read file
            content = path.read_text(encoding="utf-8", errors="replace")

            # Phase 4: Input Sanitization
            content = self._sanitize_raw(content)

            if not content.strip():
                return ProcessorOutput(markdown="", metadata={})

            soup = BeautifulSoup(content, "lxml")

            # 1. Extract Metadata BEFORE cleaning tags (title might be in head)
            title = self._get_title(soup)
            description = self._get_meta_description(soup)

            # 2. Clean Noise
            self._clean_soup(soup)

            # 3. Convert to Markdown
            # Use body if available, otherwise full soup
            root_element = soup.body or soup
            markdown = self._html_to_markdown(root_element)

            # 4. Post-process
            markdown = self._post_process(markdown)

            logger.info("html_conversion_complete", path=file_path, chars=len(markdown))

            metadata: Dict[str, Any] = {
                "source_format": "html",
                "title": title,
                "description": description,
            }

            return ProcessorOutput(markdown=markdown, metadata=metadata)

        except Exception as e:
            logger.exception("html_conversion_error", path=file_path, error=str(e))
            return ProcessorOutput(markdown="", metadata={"error": str(e)})

    def _get_title(self, soup: BeautifulSoup) -> Optional[str]:
        if soup.title and soup.title.string:
            return soup.title.string.strip()
        return None

    def _get_meta_description(self, soup: BeautifulSoup) -> Optional[str]:
        meta = soup.find("meta", attrs={"name": "description"})
        if meta and meta.get("content"):
            return meta["content"].strip()
        return None

    def _clean_soup(self, soup: BeautifulSoup) -> None:
        """Remove unwanted tags and comments."""
        # Remove tags
        for tag in self.REMOVE_TAGS:
            for element in soup.find_all(tag):
                element.decompose()

        # Remove comments
        for comment in soup.find_all(string=lambda t: isinstance(t, Comment)):
            comment.extract()

    def _html_to_markdown(self, root_element: Tag) -> str:
        """
        Recursively converts HTML to Markdown.
        Ensures consistent handling of headers and semantics for RAG.
        """

        def process_element(element):
            if isinstance(element, NavigableString):
                text = str(element).strip()
                if text:
                    return text
                return ""

            if isinstance(element, Tag):
                content = ""

                # Process children
                for child in element.children:
                    child_md = process_element(child)
                    if child_md:
                        # Add space logic for inline elements
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

                # --- Block-level Transformations ---

                # Headers (Critical for Phase 4 Chunking)
                if element.name == "h1":
                    return f"\n\n# {content}\n\n"
                elif element.name == "h2":
                    return f"\n\n## {content}\n\n"
                elif element.name == "h3":
                    return f"\n\n### {content}\n\n"
                elif element.name in ["h4", "h5", "h6"]:
                    return f"\n\n#### {content}\n\n"

                # Paragraphs and Breaks
                elif element.name == "p":
                    return f"\n\n{content}\n\n"
                elif element.name == "br":
                    return "\n"
                elif element.name == "hr":
                    return "\n\n---\n\n"

                # Semantic Layout (Phase 4 Requirement)
                # Treat articles and sections as distinct blocks
                elif element.name in ["section", "article", "main", "div"]:
                    return f"\n\n{content}\n\n"

                # Lists
                elif element.name == "li":
                    return f"\n- {content}"
                elif element.name in ["ul", "ol"]:
                    return f"\n{content}\n"

                # Quotes & Code
                elif element.name == "blockquote":
                    return f"\n> {content}\n"
                elif element.name == "pre":
                    return f"\n```\n{content}\n```\n"

                # --- Inline Transformations ---
                elif element.name in ["b", "strong"]:
                    return f"**{content}**"
                elif element.name in ["i", "em"]:
                    return f"*{content}*"
                elif element.name == "code":
                    return f"`{content}`"
                elif element.name == "a":
                    href = element.get("href", "")
                    return f"[{content}]({href})" if href else content

                # Tables (Simple text extraction)
                elif element.name == "tr":
                    return f"\n{content}"
                elif element.name in ["td", "th"]:
                    return f" {content} |"

                return content

            return ""

        return process_element(root_element)
