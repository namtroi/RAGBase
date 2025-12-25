# apps/ai-worker/src/quality/auto_fix.py
"""
Auto-Fix Rules for chunk quality improvement.
Applies automated fixes to improve chunk quality.
"""

from typing import Any, Dict, List
from src.quality.analyzer import QualityAnalyzer, QualityFlag


class AutoFixer:
    """
    Apply automated fixes to chunks based on quality analysis.
    """

    MAX_PASSES = 2
    MAX_CHUNK_SIZE = 2000
    MIN_CHUNK_SIZE = 50

    def __init__(self):
        self.analyzer = QualityAnalyzer()

    def fix(self, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Apply fixes to a list of chunks.

        Order:
        1. Skip EMPTY
        2. Split TOO_LONG
        3. Merge TOO_SHORT
        4. Re-index

        Returns:
            Fixed list of chunks
        """
        if not chunks:
            return []

        result = chunks.copy()

        for _ in range(self.MAX_PASSES):
            # Pass 1: Remove empty
            result = [c for c in result if c.get("content", "").strip()]

            # Pass 2: Split TOO_LONG
            new_result = []
            for chunk in result:
                analysis = self.analyzer.analyze(chunk)
                if QualityFlag.TOO_LONG in analysis["flags"]:
                    new_result.extend(self._split_chunk(chunk))
                else:
                    new_result.append(chunk)
            result = new_result

            # Pass 3: Merge TOO_SHORT
            result = self._merge_short_chunks(result)

        # Final: Re-index
        for i, chunk in enumerate(result):
            chunk["metadata"]["index"] = i

        return result

    def _split_chunk(self, chunk: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Split a too-long chunk into smaller pieces."""
        content = chunk["content"]
        metadata = chunk["metadata"]
        breadcrumbs = metadata.get("breadcrumbs", [])

        # Try splitting by paragraphs first
        paragraphs = content.split("\n\n")

        # If no paragraph breaks, split by sentences
        if len(paragraphs) == 1:
            paragraphs = content.split(". ")
            paragraphs = [
                p + "." if not p.endswith(".") else p for p in paragraphs if p.strip()
            ]

        result = []
        current_content = ""

        for para in paragraphs:
            test_content = current_content + "\n\n" + para if current_content else para
            if len(test_content) > self.MAX_CHUNK_SIZE and current_content:
                result.append(
                    {
                        "content": current_content.strip(),
                        "metadata": {"breadcrumbs": breadcrumbs.copy(), "index": 0},
                    }
                )
                current_content = para
            else:
                current_content = test_content

        if current_content.strip():
            result.append(
                {
                    "content": current_content.strip(),
                    "metadata": {"breadcrumbs": breadcrumbs.copy(), "index": 0},
                }
            )

        return result if result else [chunk]

    def _merge_short_chunks(self, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Merge short chunks with adjacent ones."""
        if len(chunks) <= 1:
            return chunks

        result = []
        i = 0

        while i < len(chunks):
            chunk = chunks[i]
            analysis = self.analyzer.analyze(chunk)

            if QualityFlag.TOO_SHORT in analysis["flags"] and i + 1 < len(chunks):
                # Merge with next chunk
                next_chunk = chunks[i + 1]
                merged_content = chunk["content"] + "\n\n" + next_chunk["content"]
                merged = {
                    "content": merged_content,
                    "metadata": {
                        "breadcrumbs": chunk["metadata"].get("breadcrumbs", []),
                        "index": 0,
                    },
                }
                result.append(merged)
                i += 2  # Skip next chunk since it's merged
            else:
                result.append(chunk)
                i += 1

        return result
