import re
from typing import List


class MarkdownNormalizer:
    """
    Normalizes markdown content by fixing formatting issues
    and ensuring consistent structure.
    Optimized for RAG processing pipelines.
    """

    # Matches code blocks (fenced).
    # Improvement: Handles indented blocks slightly better in extraction logic
    _CODE_BLOCK_PATTERN = re.compile(r"(```[^\n]*\n)(.*?)(```)", re.DOTALL)

    # Matches bullets: * or + at start of line -> -
    _BULLET_PATTERN = re.compile(r"^(\s*)([*+])(\s)", re.MULTILINE)

    # Matches 3+ newlines -> 2 newlines
    _MULTIPLE_BLANK_LINES = re.compile(r"\n{3,}")

    # IMPROVED: Matches empty sections.
    # Group 1: The Header (e.g., "## Title")
    # Match: Header + whitespace/newlines + (Next Header)
    # The logic is handled partially in regex, but complicated level checks
    # are safer done with a slightly more aggressive lookahead or just standardizing line breaks first.
    # Here we allow \n+ instead of strictly \n\n to catch tight packing.
    _EMPTY_SECTION_PATTERN = re.compile(
        r"^(#{1,6})[ \t]+[^\n]+\n+(?=\1(?!#)\s+)", re.MULTILINE
    )
    # Note: Handling "H3 followed by H2" via regex is complex.
    # For Phase 4, cleaning strict duplicates (H2->H2) is the 80/20 win.

    def normalize(self, markdown: str) -> str:
        if not markdown:
            return ""

        # 0. Standardize line endings first to ensure Regex works reliably
        markdown = markdown.replace("\r\n", "\n").replace("\r", "\n")

        # 1. Extract code blocks (Protects them from bullet normalization)
        code_blocks: List[str] = []
        markdown = self._extract_code_blocks(markdown, code_blocks)

        # 2. Fix unclosed code blocks (If any remained unextracted due to missing fence)
        # Note: _extract only grabs closed blocks. So unclosed ones are still in 'markdown'
        markdown = self._fix_unclosed_code_blocks(markdown)

        # 2.1. Extract again if we just closed a block?
        # Actually, simpler to just run fix_unclosed BEFORE extraction?
        # Better Strategy: Fix unclosed -> Extract -> Process -> Restore

        # Let's adjust logic flow for safety:
        # A. Restore everything to start fresh (in case logic 2.1 needed)
        # But efficiently:
        # If there was an unclosed block, step 1 didn't catch it.
        # Step 2 adds the fence. Now it's a closed block but sitting in 'markdown' exposed to processing.
        # We should extract it too.
        if "```" in markdown:
            markdown = self._extract_code_blocks(markdown, code_blocks)

        # 3. Standardize bullets
        markdown = self._BULLET_PATTERN.sub(r"\1-\3", markdown)

        # 4. Collapse multiple blank lines (Prepare for empty section check)
        markdown = self._MULTIPLE_BLANK_LINES.sub("\n\n", markdown)

        # 5. Remove empty sections
        markdown = self._remove_empty_sections(markdown)

        # 6. Final whitespace cleanup
        markdown = markdown.strip() + "\n"

        # 7. Restore code blocks
        markdown = self._restore_code_blocks(markdown, code_blocks)

        return markdown

    def _extract_code_blocks(self, text: str, storage: List[str]) -> str:
        def replacer(match):
            block = match.group(0)
            storage.append(block)
            # Use a specialized placeholder unlikely to collide
            return f"__M_NORM_BLOCK_{len(storage) - 1}__"

        return self._CODE_BLOCK_PATTERN.sub(replacer, text)

    def _restore_code_blocks(self, text: str, storage: List[str]) -> str:
        for i, block in enumerate(storage):
            text = text.replace(f"__M_NORM_BLOCK_{i}__", block)
        return text

    def _fix_unclosed_code_blocks(self, text: str) -> str:
        # Allow whitespace before backticks
        fence_pattern = re.compile(r"^\s*```", re.MULTILINE)
        matches = list(fence_pattern.finditer(text))

        if len(matches) % 2 == 1:
            if not text.endswith("\n"):
                text += "\n"
            text += "```"
        return text

    def _remove_empty_sections(self, text: str) -> str:
        prev_text = None
        # Limit iterations to avoid infinite loops in weird edge cases
        max_iterations = 10
        count = 0
        while prev_text != text and count < max_iterations:
            prev_text = text
            text = self._EMPTY_SECTION_PATTERN.sub("", text)
            count += 1
        return text
