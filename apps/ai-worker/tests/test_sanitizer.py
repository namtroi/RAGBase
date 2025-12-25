# apps/ai-worker/tests/test_sanitizer.py
"""
Unit tests for InputSanitizer module.
Tests text cleaning: null bytes, control chars, encoding issues, BOM, whitespace.
"""

import pytest

from src.sanitizer import InputSanitizer


@pytest.fixture
def sanitizer():
    """Create InputSanitizer instance."""
    return InputSanitizer()


class TestInputSanitizer:
    """Tests for InputSanitizer.sanitize() method."""

    def test_remove_null_bytes(self, sanitizer):
        """Null bytes (\\x00) are removed."""
        text = "Hello\x00World\x00!"
        result = sanitizer.sanitize(text)
        assert "\x00" not in result
        assert result == "HelloWorld!"

    def test_remove_control_chars(self, sanitizer):
        """Control chars (\\x01-\\x1f except \\n, \\t) are removed."""
        # \x01 = SOH, \x02 = STX, \x03 = ETX
        text = "Hello\x01\x02\x03World"
        result = sanitizer.sanitize(text)
        assert "\x01" not in result
        assert "\x02" not in result
        assert "\x03" not in result
        assert result == "HelloWorld"

    def test_preserve_newlines_tabs(self, sanitizer):
        """Newlines (\\n) and tabs (\\t) are preserved."""
        text = "Line1\n\tIndented line\nLine3"
        result = sanitizer.sanitize(text)
        assert "\n" in result
        assert "\t" in result
        assert result == "Line1\n\tIndented line\nLine3"

    def test_normalize_nfc(self, sanitizer):
        """Unicode is normalized to NFC form."""
        # é can be represented as decomposed (e + combining acute) or composed
        decomposed = "caf\u0065\u0301"  # e + combining acute accent
        composed = "café"  # composed é
        result = sanitizer.sanitize(decomposed)
        # After NFC normalization, should be composed form
        assert result == composed

    def test_fix_mojibake(self, sanitizer):
        """Mojibake (encoding issues) are fixed with ftfy."""
        # Common mojibake: UTF-8 interpreted as latin-1
        mojibake = "â€œHello Worldâ€\x9d"  # Curly quotes garbled
        result = sanitizer.sanitize(mojibake)
        # ftfy should fix this to proper quotes
        assert "â€" not in result

    def test_remove_bom(self, sanitizer):
        """BOM markers are stripped."""
        # UTF-8 BOM: \ufeff
        text_with_bom = "\ufeffHello World"
        result = sanitizer.sanitize(text_with_bom)
        assert not result.startswith("\ufeff")
        assert result == "Hello World"

    def test_normalize_line_endings(self, sanitizer):
        """Windows line endings (\\r\\n) are normalized to Unix (\\n)."""
        windows_text = "Line1\r\nLine2\r\nLine3"
        result = sanitizer.sanitize(windows_text)
        assert "\r\n" not in result
        assert "\r" not in result
        assert result == "Line1\nLine2\nLine3"

    def test_strip_trailing_whitespace(self, sanitizer):
        """Trailing whitespace on lines is removed."""
        text = "Line1   \nLine2\t\t\nLine3  "
        result = sanitizer.sanitize(text)
        lines = result.split("\n")
        for line in lines:
            assert line == line.rstrip()

    def test_empty_string(self, sanitizer):
        """Empty string returns empty string."""
        result = sanitizer.sanitize("")
        assert result == ""

    def test_preserves_regular_text(self, sanitizer):
        """Regular text passes through unchanged."""
        text = "The quick brown fox jumps over the lazy dog. 123!@#"
        result = sanitizer.sanitize(text)
        assert result == text

    def test_combined_issues(self, sanitizer):
        """Multiple issues in one string are all fixed."""
        text = "\ufeffHello\x00\x01World\r\n  trailing  \r\n"
        result = sanitizer.sanitize(text)
        # No BOM
        assert not result.startswith("\ufeff")
        # No null bytes
        assert "\x00" not in result
        # No control chars
        assert "\x01" not in result
        # Unix line endings
        assert "\r" not in result
        # Trailing whitespace stripped
        assert "  \n" not in result
