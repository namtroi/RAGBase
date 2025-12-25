# apps/ai-worker/src/quality/analyzer.py
"""
Quality Analyzer for chunk quality assessment.
Detects issues and assigns quality scores.
"""

from enum import Enum
from typing import Any, Dict, List


class QualityFlag(str, Enum):
    """Quality issue flags."""

    TOO_SHORT = "TOO_SHORT"
    TOO_LONG = "TOO_LONG"
    NO_CONTEXT = "NO_CONTEXT"
    FRAGMENT = "FRAGMENT"
    EMPTY = "EMPTY"


class QualityAnalyzer:
    """
    Analyze chunks for quality issues.
    """

    # Thresholds
    MIN_CHARS = 50
    MAX_CHARS = 2000
    PENALTY_PER_FLAG = 0.15

    def analyze(self, chunk: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze a chunk and return quality metrics.

        Args:
            chunk: Dict with 'content' and 'metadata' keys.

        Returns:
            Dict with flags, score, char_count, has_title, completeness.
        """
        content = chunk.get("content", "")
        metadata = chunk.get("metadata", {})
        breadcrumbs = metadata.get("breadcrumbs", [])

        flags: List[QualityFlag] = []

        # 1. Check EMPTY
        stripped = content.strip()
        if not stripped:
            flags.append(QualityFlag.EMPTY)
            return {
                "flags": flags,
                "score": 0.0,
                "char_count": 0,
                "has_title": False,
                "completeness": "empty",
            }

        char_count = len(stripped)

        # 2. Check TOO_SHORT
        if char_count < self.MIN_CHARS:
            flags.append(QualityFlag.TOO_SHORT)

        # 3. Check TOO_LONG
        if char_count > self.MAX_CHARS:
            flags.append(QualityFlag.TOO_LONG)

        # 4. Check NO_CONTEXT
        has_title = stripped.startswith("#") or stripped.startswith(">")
        has_breadcrumbs = len(breadcrumbs) > 0
        if not has_title and not has_breadcrumbs:
            flags.append(QualityFlag.NO_CONTEXT)

        # 5. Check FRAGMENT (ends mid-sentence)
        sentence_enders = (".", "!", "?", ":", "```", ">")
        last_char = stripped.rstrip()[-1] if stripped.rstrip() else ""
        if last_char not in sentence_enders and not stripped.endswith("```"):
            flags.append(QualityFlag.FRAGMENT)

        # Calculate score
        score = max(0.0, 1.0 - (self.PENALTY_PER_FLAG * len(flags)))

        # Determine completeness
        if QualityFlag.FRAGMENT in flags:
            completeness = "partial"
        elif QualityFlag.EMPTY in flags:
            completeness = "empty"
        else:
            completeness = "complete"

        return {
            "flags": flags,
            "score": score,
            "char_count": char_count,
            "has_title": has_title,
            "completeness": completeness,
        }
