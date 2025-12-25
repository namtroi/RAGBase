# apps/ai-worker/tests/test_quality_analyzer.py
"""
Unit tests for QualityAnalyzer.
Tests chunk quality flags, scoring, and metrics.
"""

import pytest
from src.quality.analyzer import QualityAnalyzer, QualityFlag


@pytest.fixture
def analyzer():
    """Create a QualityAnalyzer instance."""
    return QualityAnalyzer()


class TestQualityFlags:
    """Tests for quality flag detection."""

    def test_flag_too_short(self, analyzer):
        """Chunks < 50 chars are flagged TOO_SHORT."""
        chunk = {"content": "Short.", "metadata": {"breadcrumbs": []}}
        result = analyzer.analyze(chunk)
        assert QualityFlag.TOO_SHORT in result["flags"]

    def test_flag_too_long(self, analyzer):
        """Chunks > 2000 chars are flagged TOO_LONG."""
        chunk = {"content": "x" * 2100, "metadata": {"breadcrumbs": []}}
        result = analyzer.analyze(chunk)
        assert QualityFlag.TOO_LONG in result["flags"]

    def test_flag_no_context(self, analyzer):
        """Chunks without title or breadcrumbs are flagged NO_CONTEXT."""
        chunk = {"content": "Some content here.", "metadata": {"breadcrumbs": []}}
        result = analyzer.analyze(chunk)
        assert QualityFlag.NO_CONTEXT in result["flags"]

    def test_flag_fragment(self, analyzer):
        """Chunks ending mid-sentence are flagged FRAGMENT."""
        chunk = {
            "content": "This is an incomplete",
            "metadata": {"breadcrumbs": ["Title"]},
        }
        result = analyzer.analyze(chunk)
        assert QualityFlag.FRAGMENT in result["flags"]

    def test_flag_empty(self, analyzer):
        """Empty or whitespace-only chunks are flagged EMPTY."""
        chunk = {"content": "   ", "metadata": {"breadcrumbs": []}}
        result = analyzer.analyze(chunk)
        assert QualityFlag.EMPTY in result["flags"]


class TestQualityScore:
    """Tests for quality scoring."""

    def test_perfect_score(self, analyzer):
        """No issues results in score 1.0."""
        chunk = {
            "content": "# Title\n\nThis is a complete sentence with enough content to pass the minimum threshold.",
            "metadata": {"breadcrumbs": ["Title"]},
        }
        result = analyzer.analyze(chunk)
        assert result["score"] == 1.0
        assert result["flags"] == []

    def test_penalty_per_flag(self, analyzer):
        """Each flag reduces the score."""
        # Too short + no context = 2 flags
        chunk = {"content": "Hi.", "metadata": {"breadcrumbs": []}}
        result = analyzer.analyze(chunk)
        assert result["score"] < 1.0
        assert result["score"] == 1.0 - (0.15 * len(result["flags"]))


class TestQualityMetrics:
    """Tests for quality metrics."""

    def test_char_count(self, analyzer):
        """char_count reflects content length."""
        chunk = {"content": "Hello World", "metadata": {"breadcrumbs": []}}
        result = analyzer.analyze(chunk)
        assert result["char_count"] == 11

    def test_has_title_true(self, analyzer):
        """has_title is True when content starts with #."""
        chunk = {
            "content": "# Title\n\nContent here.",
            "metadata": {"breadcrumbs": ["Title"]},
        }
        result = analyzer.analyze(chunk)
        assert result["has_title"] is True

    def test_has_title_false(self, analyzer):
        """has_title is False when no heading."""
        chunk = {"content": "Just plain text.", "metadata": {"breadcrumbs": []}}
        result = analyzer.analyze(chunk)
        assert result["has_title"] is False

    def test_completeness_complete(self, analyzer):
        """completeness is 'complete' for proper sentences."""
        chunk = {
            "content": "# Title\n\nThis is complete.",
            "metadata": {"breadcrumbs": ["Title"]},
        }
        result = analyzer.analyze(chunk)
        assert result["completeness"] == "complete"

    def test_completeness_partial(self, analyzer):
        """completeness is 'partial' for fragments."""
        chunk = {
            "content": "This is incomplete",
            "metadata": {"breadcrumbs": ["Title"]},
        }
        result = analyzer.analyze(chunk)
        assert result["completeness"] == "partial"
