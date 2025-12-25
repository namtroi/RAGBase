# apps/ai-worker/tests/test_auto_fix.py
"""
Unit tests for AutoFixer.
Tests chunk quality auto-fix rules.
"""

import pytest
from src.quality.auto_fix import AutoFixer


@pytest.fixture
def fixer():
    """Create an AutoFixer instance."""
    return AutoFixer()


class TestAutoFix:
    """Tests for AutoFixer class."""

    def test_split_too_long(self, fixer):
        """TOO_LONG chunks are split."""
        long_content = "Sentence one. " * 200  # > 2000 chars
        chunks = [
            {
                "content": long_content,
                "metadata": {"breadcrumbs": ["Title"], "index": 0},
            }
        ]

        fixed = fixer.fix(chunks)

        assert len(fixed) > 1
        for chunk in fixed:
            assert len(chunk["content"]) <= 2000

    def test_merge_too_short(self, fixer):
        """TOO_SHORT chunks are merged with adjacent."""
        chunks = [
            {"content": "Hi.", "metadata": {"breadcrumbs": ["Title"], "index": 0}},
            {
                "content": "This is a longer chunk with more than fifty characters of content.",
                "metadata": {"breadcrumbs": ["Title"], "index": 1},
            },
        ]

        fixed = fixer.fix(chunks)

        # Should be merged into a single chunk
        assert len(fixed) == 1
        assert "Hi." in fixed[0]["content"]

    def test_skip_empty(self, fixer):
        """EMPTY chunks are removed."""
        chunks = [
            {"content": "   ", "metadata": {"breadcrumbs": [], "index": 0}},
            {
                "content": "Valid content here with enough length.",
                "metadata": {"breadcrumbs": ["Title"], "index": 1},
            },
        ]

        fixed = fixer.fix(chunks)

        assert len(fixed) == 1
        assert "Valid content" in fixed[0]["content"]

    def test_inject_context(self, fixer):
        """NO_CONTEXT chunks get breadcrumb header injected."""
        chunks = [
            {
                "content": "No heading here just plain text.",
                "metadata": {"breadcrumbs": [], "index": 0},
            }
        ]

        # This chunk has no breadcrumbs so will be flagged NO_CONTEXT
        # The fixer should NOT inject anything since there's no breadcrumb to inject
        fixed = fixer.fix(chunks)

        # Since there are no breadcrumbs, nothing to inject - should remain as is
        assert len(fixed) == 1

    def test_max_passes_limit(self, fixer):
        """Max passes prevent infinite loops."""
        # Create a scenario that could loop
        chunks = [{"content": "x", "metadata": {"breadcrumbs": [], "index": 0}}]

        # Should not hang
        fixed = fixer.fix(chunks)
        assert isinstance(fixed, list)

    def test_reindex_after_fix(self, fixer):
        """Indices are correct after fixes."""
        chunks = [
            {"content": "Short.", "metadata": {"breadcrumbs": ["A"], "index": 0}},
            {"content": "Also short.", "metadata": {"breadcrumbs": ["A"], "index": 1}},
            {
                "content": "This is a much longer valid content chunk with proper length.",
                "metadata": {"breadcrumbs": ["A"], "index": 2},
            },
        ]

        fixed = fixer.fix(chunks)

        # Check indices are sequential
        for i, chunk in enumerate(fixed):
            assert chunk["metadata"]["index"] == i
