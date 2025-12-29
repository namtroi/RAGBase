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
    """Tests for quality scoring using multi-factor system."""

    def test_perfect_score(self, analyzer):
        """A well-formed chunk with ideal length achieves score 1.0."""
        # Create content with ~1000 chars (ideal_length) to max out length_score
        # - Has title (starts with #) -> context_score = 1.0
        # - Has breadcrumbs -> context_score = 1.0
        # - Ends with period -> completeness_score = 1.0
        # - No flags -> base_quality = 1.0
        # - Length ~1000 chars -> length_score = 1.0
        # Score = 1.0*0.4 + 1.0*0.3 + 1.0*0.2 + 1.0*0.1 = 1.0
        content = (
            "# Title\n\n" + "This is a great paragraph with meaningful content. " * 20
        )
        chunk = {
            "content": content,
            "metadata": {"breadcrumbs": ["Title"]},
        }
        result = analyzer.analyze(chunk)
        assert result["score"] == 1.0
        assert result["flags"] == []

    def test_penalty_per_flag(self, analyzer):
        """Flags reduce score via multi-factor weighted calculation."""
        # "Hi." = 3 chars -> TOO_SHORT flag, no breadcrumbs -> NO_CONTEXT flag
        # Ends with '.' -> ends_properly = True, no FRAGMENT flag
        # Calculations:
        # - base_quality = 1.0 - (0.15 * 2) = 0.70
        # - length_score = min(1.0, 3/1000) = 0.003
        # - context_score = 0.5 (no title, no breadcrumbs)
        # - completeness_score = 1.0 (ends properly)
        # Score = 0.70*0.4 + 0.003*0.3 + 0.5*0.2 + 1.0*0.1 = 0.28 + 0.001 + 0.1 + 0.1 = 0.48
        chunk = {"content": "Hi.", "metadata": {"breadcrumbs": []}}
        result = analyzer.analyze(chunk)
        assert result["score"] < 1.0
        # Verify the exact calculation with multi-factor scoring
        assert result["score"] == 0.48


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
