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

    Accepts configurable thresholds for quality assessment.
    """

    def __init__(
        self,
        min_chars: int = 50,
        max_chars: int = 2000,
        ideal_length: int = 1000,
        penalty_per_flag: float = 0.15,
    ):
        """Initialize analyzer with configurable thresholds.

        Args:
            min_chars: Minimum characters for a chunk to be considered complete.
            max_chars: Maximum characters before flagging as TOO_LONG.
            ideal_length: Target chunk size for optimal length score.
            penalty_per_flag: Score reduction per quality flag.
        """
        self.min_chars = min_chars
        self.max_chars = max_chars
        self.ideal_length = ideal_length
        self.penalty_per_flag = penalty_per_flag

    def analyze(self, chunk: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze a chunk and return quality metrics using multi-factor scoring.

        Factors:
        - Base quality (40%): Penalty-based on flags
        - Length score (30%): Proportional to ideal length
        - Context score (20%): Has title/breadcrumbs
        - Completeness (10%): Ends properly

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
        if char_count < self.min_chars:
            flags.append(QualityFlag.TOO_SHORT)

        # 3. Check TOO_LONG
        if char_count > self.max_chars:
            flags.append(QualityFlag.TOO_LONG)

        # 4. Check context
        has_title = stripped.startswith("#") or stripped.startswith(">")
        has_breadcrumbs = len(breadcrumbs) > 0
        if not has_title and not has_breadcrumbs:
            flags.append(QualityFlag.NO_CONTEXT)

        # 5. Check FRAGMENT (ends mid-sentence)
        sentence_enders = (".", "!", "?", ":", "```", ">")
        last_char = stripped.rstrip()[-1] if stripped.rstrip() else ""
        ends_properly = last_char in sentence_enders or stripped.endswith("```")
        if not ends_properly:
            flags.append(QualityFlag.FRAGMENT)

        # === Multi-Factor Score Calculation ===

        # Factor 1: Base quality (40%) - flag penalty
        flag_penalty = self.penalty_per_flag * len(flags)
        base_quality = max(0.0, 1.0 - flag_penalty)

        # Factor 2: Length score (30%) - proportional to ideal chunk size
        # Score increases as chunk approaches ideal_length, capped at 1.0
        length_score = min(1.0, char_count / self.ideal_length)

        # Factor 3: Context score (20%) - has structural markers
        context_score = 1.0 if (has_title or has_breadcrumbs) else 0.5

        # Factor 4: Completeness score (10%) - ends properly
        completeness_score = 1.0 if ends_properly else 0.7

        # Weighted average
        score = (
            base_quality * 0.40
            + length_score * 0.30
            + context_score * 0.20
            + completeness_score * 0.10
        )

        # Determine completeness label
        if QualityFlag.FRAGMENT in flags:
            completeness = "partial"
        elif QualityFlag.EMPTY in flags:
            completeness = "empty"
        else:
            completeness = "complete"

        return {
            "flags": flags,
            "score": round(score, 2),
            "char_count": char_count,
            "has_title": has_title,
            "completeness": completeness,
        }
