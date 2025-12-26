# apps/ai-worker/src/metrics.py
"""Metrics collection for processing pipeline analytics."""

import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


@dataclass
class TimingMetrics:
    """Timing breakdown for processing stages."""

    conversion_time_ms: int = 0
    chunking_time_ms: int = 0
    embedding_time_ms: int = 0
    total_time_ms: int = 0


@dataclass
class SizeMetrics:
    """Size metrics for document processing."""

    raw_size_bytes: int = 0
    markdown_size_chars: int = 0


@dataclass
class ChunkingMetrics:
    """Chunking efficiency metrics."""

    total_chunks: int = 0
    avg_chunk_size: float = 0.0
    oversized_chunks: int = 0


@dataclass
class QualitySummary:
    """Aggregated quality metrics."""

    avg_quality_score: float = 0.0
    quality_flags: Dict[str, int] = field(default_factory=dict)
    total_tokens: int = 0


@dataclass
class ProcessingMetrics:
    """Complete metrics for a processing job."""

    timing: TimingMetrics = field(default_factory=TimingMetrics)
    size: SizeMetrics = field(default_factory=SizeMetrics)
    chunking: ChunkingMetrics = field(default_factory=ChunkingMetrics)
    quality: QualitySummary = field(default_factory=QualitySummary)
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


# Threshold for oversized chunks (characters)
OVERSIZED_CHUNK_THRESHOLD = 1500


class MetricsCollector:
    """Collect timing and metrics during processing."""

    def __init__(self):
        self._stage_start: float = 0
        self._metrics = ProcessingMetrics()

    def mark_started(self) -> None:
        """Mark the start of processing."""
        self._metrics.started_at = datetime.now(timezone.utc).isoformat()

    def mark_completed(self) -> None:
        """Mark the completion of processing."""
        self._metrics.completed_at = datetime.now(timezone.utc).isoformat()

    def start_stage(self) -> None:
        """Start timing a processing stage."""
        self._stage_start = time.time()

    def end_conversion(self) -> int:
        """End conversion stage timing and return elapsed ms."""
        elapsed_ms = int((time.time() - self._stage_start) * 1000)
        self._metrics.timing.conversion_time_ms = elapsed_ms
        return elapsed_ms

    def end_chunking(self) -> int:
        """End chunking stage timing and return elapsed ms."""
        elapsed_ms = int((time.time() - self._stage_start) * 1000)
        self._metrics.timing.chunking_time_ms = elapsed_ms
        return elapsed_ms

    def end_embedding(self) -> int:
        """End embedding stage timing and return elapsed ms."""
        elapsed_ms = int((time.time() - self._stage_start) * 1000)
        self._metrics.timing.embedding_time_ms = elapsed_ms
        return elapsed_ms

    def set_embedding_time(self, time_ms: int) -> None:
        """Set embedding time directly (from pipeline)."""
        self._metrics.timing.embedding_time_ms = time_ms

    def set_size_metrics(self, raw_bytes: int, markdown_chars: int) -> None:
        """Set document size metrics."""
        self._metrics.size.raw_size_bytes = raw_bytes
        self._metrics.size.markdown_size_chars = markdown_chars

    def set_chunking_metrics(self, chunks: List[Dict[str, Any]]) -> None:
        """Calculate and set chunking efficiency metrics."""
        if not chunks:
            return

        total = len(chunks)
        sizes = [len(c.get("content", "")) for c in chunks]
        avg_size = sum(sizes) / total if total > 0 else 0
        oversized = sum(1 for s in sizes if s > OVERSIZED_CHUNK_THRESHOLD)

        self._metrics.chunking.total_chunks = total
        self._metrics.chunking.avg_chunk_size = avg_size
        self._metrics.chunking.oversized_chunks = oversized

    def set_quality_summary(self, chunks: List[Dict[str, Any]]) -> None:
        """Aggregate quality metrics from chunks."""
        if not chunks:
            return

        scores: List[float] = []
        flags: Dict[str, int] = {}
        total_tokens = 0

        for chunk in chunks:
            meta = chunk.get("metadata", {})
            if "qualityScore" in meta and meta["qualityScore"] is not None:
                scores.append(meta["qualityScore"])
            for flag in meta.get("qualityFlags", []):
                flags[flag] = flags.get(flag, 0) + 1
            total_tokens += meta.get("tokenCount", 0) or 0

        self._metrics.quality.avg_quality_score = (
            sum(scores) / len(scores) if scores else 0
        )
        self._metrics.quality.quality_flags = flags
        self._metrics.quality.total_tokens = total_tokens

    def finalize(self) -> ProcessingMetrics:
        """Calculate totals and return final metrics."""
        timing = self._metrics.timing
        timing.total_time_ms = (
            timing.conversion_time_ms
            + timing.chunking_time_ms
            + timing.embedding_time_ms
        )
        return self._metrics

    def to_dict(self) -> Dict[str, Any]:
        """Convert metrics to dictionary for callback payload."""
        self.finalize()
        m = self._metrics
        return {
            "startedAt": m.started_at,
            "completedAt": m.completed_at,
            "conversionTimeMs": m.timing.conversion_time_ms,
            "chunkingTimeMs": m.timing.chunking_time_ms,
            "embeddingTimeMs": m.timing.embedding_time_ms,
            "totalTimeMs": m.timing.total_time_ms,
            "rawSizeBytes": m.size.raw_size_bytes,
            "markdownSizeChars": m.size.markdown_size_chars,
            "totalChunks": m.chunking.total_chunks,
            "avgChunkSize": m.chunking.avg_chunk_size,
            "oversizedChunks": m.chunking.oversized_chunks,
            "avgQualityScore": m.quality.avg_quality_score,
            "qualityFlags": m.quality.quality_flags,
            "totalTokens": m.quality.total_tokens,
        }
