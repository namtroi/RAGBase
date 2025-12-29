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

    # Page number artifact patterns (strict: 1-999 only)
    _PAGE_ARTIFACT_PATTERNS = [
        re.compile(r"^[1-9]\d{0,2}$"),  # Standalone: 1-999
        re.compile(r"^[Pp]age\s+[1-9]\d{0,2}$"),  # "page 12", "Page 5"
        re.compile(r"^[-–—]\s*[1-9]\d{0,2}\s*[-–—]$"),  # "- 5 -", "— 12 —"
    ]

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

    def remove_page_artifacts(self, markdown: str) -> str:
        """
        Remove standalone page numbers from markdown (PDF-specific).
        Uses paragraph-level analysis with strict patterns.
        """
        if not markdown:
            return ""

        paragraphs = re.split(r"\n\s*\n", markdown)
        result = []

        for para in paragraphs:
            stripped = para.strip()

            # Keep empty paragraphs (preserve spacing)
            if not stripped:
                result.append(para)
                continue

            # Keep multi-line paragraphs (page nums are single-line)
            if "\n" in stripped:
                result.append(para)
                continue

            # Check if single-line matches any page pattern
            is_page = any(p.match(stripped) for p in self._PAGE_ARTIFACT_PATTERNS)
            if not is_page:
                result.append(para)

        return "\n\n".join(result)

    def remove_junk_code_blocks(self, markdown: str) -> str:
        """
        Remove code blocks that are:
        - Empty (only whitespace)
        - Only contain page numbers (with optional whitespace/pipes)
        Includes surrounding newlines in match, replaces with normalized spacing.
        """
        if not markdown:
            return ""

        # Pattern 1: Empty code blocks + surrounding newlines
        empty_pattern = re.compile(r"\n*```[^\n]*\n\s*```\n*", re.MULTILINE)
        markdown = empty_pattern.sub("\n\n", markdown)

        # Pattern 2: Code blocks with page number + surrounding newlines
        page_pattern = re.compile(
            r"\n*```[^\n]*\n[\s|]*[1-9]\d{0,2}[\s|]*\n```\n*",
            re.MULTILINE,
        )
        markdown = page_pattern.sub("\n\n", markdown)

        return markdown

    def merge_soft_linebreaks(self, markdown: str) -> str:
        """
        Merge single newlines within paragraphs (PDF-specific).
        PDF rendering creates hard line breaks at page-width boundaries.
        This joins them to form proper paragraphs for better chunking.

        Rules (conservative):
        - ONLY merge if next line starts with lowercase [a-z]
        - DON'T merge if current line ends with closing bracket ] or )
        - DON'T merge lines starting with markdown syntax: # - * > | digit.
        - Protect code blocks from processing
        """
        if not markdown:
            return ""

        # 1. Extract code blocks to protect them
        code_blocks: List[str] = []
        markdown = self._extract_code_blocks(markdown, code_blocks)

        # 2. Process line by line
        lines = markdown.split("\n")
        result = []

        # Patterns for lines that should NOT be merged into
        skip_patterns = re.compile(
            r"^\s*("
            r"#{1,6}\s|"  # Headings
            r"[-*+]\s|"  # List items
            r"\d+\.\s|"  # Numbered lists
            r">\s?|"  # Blockquotes
            r"\|"  # Tables
            r")"
        )

        i = 0
        while i < len(lines):
            current = lines[i]
            current_stripped = current.rstrip()

            # Check if we should try to merge with next line
            if i + 1 < len(lines):
                next_line = lines[i + 1]
                next_stripped = next_line.lstrip()

                # Handle empty line (potential paragraph break)
                if not next_stripped:
                    # Check if this is a PDF artifact (fake paragraph break)
                    # Pattern: "mid-sentence\n\nlowercase continuation"
                    if i + 2 < len(lines) and current_stripped:
                        after_empty = lines[i + 2].lstrip()
                        no_sentence_end = not re.search(r"[.!?:]$", current_stripped)
                        lowercase_start = bool(re.match(r"[a-z]", after_empty))
                        no_bracket_end = not re.search(r"[\]\)]$", current_stripped)

                        if no_sentence_end and lowercase_start and no_bracket_end:
                            # PDF artifact → merge across empty line
                            merged = current_stripped + " " + after_empty
                            lines[i + 2] = merged
                            i += 2  # skip current + empty line
                            continue

                    # Real paragraph break → keep
                    result.append(current)
                    i += 1
                    continue

                # Skip if next line starts with markdown syntax
                if skip_patterns.match(next_stripped):
                    result.append(current)
                    i += 1
                    continue

                # Skip if current line is empty
                if not current_stripped:
                    result.append(current)
                    i += 1
                    continue

                # Conservative merge: ONLY if next starts lowercase
                starts_with_lowercase = bool(re.match(r"[a-z]", next_stripped))
                ends_with_bracket = bool(re.search(r"[\]\)]$", current_stripped))

                if starts_with_lowercase and not ends_with_bracket:
                    # Safe to merge: lowercase continuation
                    merged = current_stripped + " " + next_stripped
                    lines[i + 1] = merged  # Replace next with merged
                    i += 1  # Skip current, process merged as next
                else:
                    # Keep newline: capital/bracket = new item/sentence
                    result.append(current)
                    i += 1
            else:
                result.append(current)
                i += 1

        markdown = "\n".join(result)

        # 3. Restore code blocks
        markdown = self._restore_code_blocks(markdown, code_blocks)

        return markdown
