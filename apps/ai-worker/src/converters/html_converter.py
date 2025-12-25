# apps/ai-worker/src/converters/html_converter.py
"""HTML converter using BeautifulSoup and markdownify."""

from pathlib import Path
from typing import List

import markdownify
from bs4 import BeautifulSoup

from src.logging_config import get_logger
from src.models import ProcessorOutput
from src.sanitizer import InputSanitizer

from .base import FormatConverter

logger = get_logger(__name__)


class HtmlConverter(FormatConverter):
    """
    Converts HTML files to Markdown.
    Removes scripts, styles, and navigation elements.
    """

    category = "document"
    REMOVE_TAGS: List[str] = ["script", "style", "nav", "footer", "aside", "noscript"]

    def __init__(self):
        self.sanitizer = InputSanitizer()

    async def to_markdown(self, file_path: str) -> ProcessorOutput:
        """Convert HTML to Markdown."""
        try:
            path = Path(file_path)
            if not path.exists():
                return ProcessorOutput(
                    markdown="", metadata={"error": f"File not found: {file_path}"}
                )

            content = path.read_text(encoding="utf-8", errors="replace")
            content = self.sanitizer.sanitize(content)

            if not content.strip():
                return ProcessorOutput(markdown="", metadata={})

            soup = BeautifulSoup(content, "lxml")

            # Remove unwanted tags
            for tag in self.REMOVE_TAGS:
                for element in soup.find_all(tag):
                    element.decompose()

            # Remove HTML comments
            from bs4 import Comment

            for comment in soup.find_all(string=lambda t: isinstance(t, Comment)):
                comment.extract()

            # Get body or full document
            body = soup.body or soup

            # Convert to markdown
            markdown = markdownify.markdownify(
                str(body),
                heading_style="ATX",
                bullets="-",
                strip=["img"],
            )

            # Clean up extra whitespace
            lines = markdown.split("\n")
            cleaned_lines = []
            prev_blank = False
            for line in lines:
                is_blank = not line.strip()
                if is_blank and prev_blank:
                    continue
                cleaned_lines.append(line)
                prev_blank = is_blank

            markdown = "\n".join(cleaned_lines).strip()

            logger.info("html_conversion_complete", path=file_path, chars=len(markdown))

            return ProcessorOutput(markdown=markdown, metadata={"format": "html"})

        except Exception as e:
            logger.exception("html_conversion_error", path=file_path, error=str(e))
            return ProcessorOutput(markdown="", metadata={"error": str(e)})
