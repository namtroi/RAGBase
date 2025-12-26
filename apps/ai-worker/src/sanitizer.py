# apps/ai-worker/src/sanitizer.py
"""
Input Sanitizer for text preprocessing.
Cleans text content before further processing.
"""

import re
import unicodedata

import ftfy


class InputSanitizer:
    """
    Sanitizes raw text input by removing problematic characters
    and normalizing encoding issues.
    """

    # Control characters to remove (0x01-0x1f), excluding \t (0x09) and \n (0x0a)
    _CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

    def sanitize(self, text: str) -> str:
        """
        Sanitize text by cleaning encoding issues, control characters,
        and normalizing whitespace.

        Args:
            text: Raw text input

        Returns:
            Cleaned text ready for processing
        """
        if not text:
            return ""

        # 1. Fix mojibake and encoding issues with ftfy
        text = ftfy.fix_text(text)

        # 2. Remove BOM (Byte Order Mark)
        text = text.lstrip("\ufeff")

        # 3. Normalize to NFC unicode form
        text = unicodedata.normalize("NFC", text)

        # 4. Remove null bytes and control characters (keep \n and \t)
        text = self._CONTROL_CHAR_PATTERN.sub("", text)

        # 5. Normalize line endings: \r\n and \r -> \n
        text = text.replace("\r\n", "\n").replace("\r", "\n")

        # 6. Strip trailing whitespace from each line
        text = re.sub(r"[ \t]+$", "", text, flags=re.MULTILINE)

        return text
