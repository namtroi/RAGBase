# apps/ai-worker/src/normalizer.py
"""
Markdown Normalizer for consistent markdown formatting.
Cleans and standardizes markdown output from format processors.
"""

import re
from typing import List


class MarkdownNormalizer:
    """
    Normalizes markdown content by fixing formatting issues
    and ensuring consistent structure.
    """

    # Regex to match code blocks (captures fence and content)
    _CODE_BLOCK_PATTERN = re.compile(r"(```[^\n]*\n)(.*?)(```)", re.DOTALL)

    # Regex to match bullets at start of line (after optional whitespace)
    _BULLET_PATTERN = re.compile(r"^(\s*)([*+])(\s)", re.MULTILINE)

    # Regex to match 3+ consecutive newlines
    _MULTIPLE_BLANK_LINES = re.compile(r"\n{3,}")

    # Regex to match empty sections: same-level heading followed by same-or-lower level heading
    # Only removes truly empty sections (no content, just heading -> heading of same level or less #s)
    _EMPTY_SECTION_PATTERN = re.compile(
        r"^(#{1,6})\s+[^\n]+\n\n(?=\1(?!#)\s+)", re.MULTILINE
    )

    def normalize(self, markdown: str) -> str:
        """
        Normalize markdown by cleaning formatting and structure.

        Args:
            markdown: Raw markdown content

        Returns:
            Cleaned and consistent markdown
        """
        if not markdown:
            return ""

        # 1. Extract and preserve code blocks
        code_blocks: List[str] = []
        markdown = self._extract_code_blocks(markdown, code_blocks)

        # 2. Fix unclosed code blocks
        markdown = self._fix_unclosed_code_blocks(markdown)

        # 3. Standardize bullets (* and + to -)
        markdown = self._BULLET_PATTERN.sub(r"\1-\3", markdown)

        # 4. Remove empty sections (heading with no content before next heading)
        markdown = self._remove_empty_sections(markdown)

        # 5. Collapse multiple blank lines to max 2 (one blank line)
        markdown = self._MULTIPLE_BLANK_LINES.sub("\n\n", markdown)

        # 6. Restore code blocks
        markdown = self._restore_code_blocks(markdown, code_blocks)

        return markdown

    def _extract_code_blocks(self, text: str, storage: List[str]) -> str:
        """
        Extract code blocks and replace with placeholders.

        Args:
            text: Markdown text
            storage: List to store extracted blocks

        Returns:
            Text with code blocks replaced by placeholders
        """

        def replacer(match):
            block = match.group(0)
            storage.append(block)
            return f"__CODE_BLOCK_{len(storage) - 1}__"

        return self._CODE_BLOCK_PATTERN.sub(replacer, text)

    def _restore_code_blocks(self, text: str, storage: List[str]) -> str:
        """
        Restore code blocks from placeholders.

        Args:
            text: Text with placeholders
            storage: List of stored code blocks

        Returns:
            Text with code blocks restored
        """
        for i, block in enumerate(storage):
            text = text.replace(f"__CODE_BLOCK_{i}__", block)
        return text

    def _fix_unclosed_code_blocks(self, text: str) -> str:
        """
        Close any unclosed code blocks.

        Args:
            text: Markdown text

        Returns:
            Text with all code blocks properly closed
        """
        # Count opening and closing fences
        fence_pattern = re.compile(r"^```", re.MULTILINE)
        matches = list(fence_pattern.finditer(text))

        if len(matches) % 2 == 1:
            # Odd number = unclosed block, add closing fence
            if not text.endswith("\n"):
                text += "\n"
            text += "```"

        return text

    def _remove_empty_sections(self, text: str) -> str:
        """
        Remove headings that have no content (followed by another heading).

        Args:
            text: Markdown text

        Returns:
            Text with empty sections removed
        """
        # Keep removing until no more empty sections
        prev_text = None
        while prev_text != text:
            prev_text = text
            text = self._EMPTY_SECTION_PATTERN.sub("", text)
        return text
