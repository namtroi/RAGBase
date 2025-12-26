# apps/ai-worker/tests/test_metrics.py
"""Tests for MetricsCollector class."""

import time

import pytest

from src.metrics import MetricsCollector, OVERSIZED_CHUNK_THRESHOLD


class TestMetricsCollector:
    """Test suite for MetricsCollector."""

    def test_should_capture_conversion_time_in_milliseconds(self):
        """Conversion timing should be captured accurately."""
        collector = MetricsCollector()
        collector.start_stage()
        time.sleep(0.05)  # 50ms
        elapsed = collector.end_conversion()
        assert 40 <= elapsed <= 150  # Allow timing variance

    def test_should_capture_chunking_time_in_milliseconds(self):
        """Chunking timing should be captured accurately."""
        collector = MetricsCollector()
        collector.start_stage()
        time.sleep(0.05)  # 50ms
        elapsed = collector.end_chunking()
        assert elapsed >= 40

    def test_should_capture_embedding_time_in_milliseconds(self):
        """Embedding timing should be captured accurately."""
        collector = MetricsCollector()
        collector.start_stage()
        time.sleep(0.05)  # 50ms
        elapsed = collector.end_embedding()
        assert elapsed >= 40

    def test_should_set_embedding_time_directly(self):
        """Embedding time can be set directly from pipeline."""
        collector = MetricsCollector()
        collector.set_embedding_time(250)
        assert collector._metrics.timing.embedding_time_ms == 250

    def test_should_calculate_total_time_as_sum_of_stages(self):
        """Total time should be sum of all stage times."""
        collector = MetricsCollector()
        collector._metrics.timing.conversion_time_ms = 100
        collector._metrics.timing.chunking_time_ms = 50
        collector._metrics.timing.embedding_time_ms = 150
        metrics = collector.finalize()
        assert metrics.timing.total_time_ms == 300

    def test_should_set_size_metrics(self):
        """Size metrics should be set correctly."""
        collector = MetricsCollector()
        collector.set_size_metrics(raw_bytes=1024, markdown_chars=500)
        assert collector._metrics.size.raw_size_bytes == 1024
        assert collector._metrics.size.markdown_size_chars == 500

    def test_should_calculate_chunking_metrics_total_chunks(self):
        """Total chunks count should be calculated."""
        chunks = [
            {"content": "a" * 500},
            {"content": "b" * 1000},
            {"content": "c" * 800},
        ]
        collector = MetricsCollector()
        collector.set_chunking_metrics(chunks)
        assert collector._metrics.chunking.total_chunks == 3

    def test_should_calculate_chunking_metrics_avg_size(self):
        """Average chunk size should be calculated correctly."""
        chunks = [
            {"content": "a" * 300},
            {"content": "b" * 600},
            {"content": "c" * 900},
        ]
        collector = MetricsCollector()
        collector.set_chunking_metrics(chunks)
        assert collector._metrics.chunking.avg_chunk_size == pytest.approx(
            600.0, rel=0.01
        )

    def test_should_calculate_chunking_metrics_oversized(self):
        """Oversized chunks should be counted based on threshold."""
        chunks = [
            {"content": "a" * 500},
            {"content": "b" * 1000},
            {"content": "c" * 2000},  # oversized
            {"content": "d" * 1800},  # oversized
        ]
        collector = MetricsCollector()
        collector.set_chunking_metrics(chunks)
        assert collector._metrics.chunking.oversized_chunks == 2

    def test_should_handle_empty_chunks_for_chunking_metrics(self):
        """Empty chunks list should not cause errors."""
        collector = MetricsCollector()
        collector.set_chunking_metrics([])
        assert collector._metrics.chunking.total_chunks == 0
        assert collector._metrics.chunking.avg_chunk_size == 0.0
        assert collector._metrics.chunking.oversized_chunks == 0

    def test_should_aggregate_quality_score_average(self):
        """Average quality score should be calculated."""
        chunks = [
            {"metadata": {"qualityScore": 0.8}},
            {"metadata": {"qualityScore": 0.9}},
            {"metadata": {"qualityScore": 0.7}},
        ]
        collector = MetricsCollector()
        collector.set_quality_summary(chunks)
        assert collector._metrics.quality.avg_quality_score == pytest.approx(
            0.8, rel=0.01
        )

    def test_should_aggregate_quality_flags(self):
        """Quality flags should be aggregated with counts."""
        chunks = [
            {"metadata": {"qualityFlags": ["TOO_SHORT"]}},
            {"metadata": {"qualityFlags": []}},
            {"metadata": {"qualityFlags": ["TOO_SHORT", "NO_CONTEXT"]}},
        ]
        collector = MetricsCollector()
        collector.set_quality_summary(chunks)
        assert collector._metrics.quality.quality_flags == {
            "TOO_SHORT": 2,
            "NO_CONTEXT": 1,
        }

    def test_should_aggregate_total_tokens(self):
        """Total tokens should be summed from all chunks."""
        chunks = [
            {"metadata": {"tokenCount": 100}},
            {"metadata": {"tokenCount": 150}},
            {"metadata": {"tokenCount": 120}},
        ]
        collector = MetricsCollector()
        collector.set_quality_summary(chunks)
        assert collector._metrics.quality.total_tokens == 370

    def test_should_handle_missing_quality_metadata(self):
        """Missing quality metadata should not cause errors."""
        chunks = [
            {"metadata": {}},
            {"content": "no metadata"},
        ]
        collector = MetricsCollector()
        collector.set_quality_summary(chunks)
        assert collector._metrics.quality.avg_quality_score == 0
        assert collector._metrics.quality.quality_flags == {}
        assert collector._metrics.quality.total_tokens == 0

    def test_should_handle_none_quality_score(self):
        """None quality score should be skipped in average calculation."""
        chunks = [
            {"metadata": {"qualityScore": 0.8}},
            {"metadata": {"qualityScore": None}},
            {"metadata": {"qualityScore": 0.9}},
        ]
        collector = MetricsCollector()
        collector.set_quality_summary(chunks)
        assert collector._metrics.quality.avg_quality_score == pytest.approx(
            0.85, rel=0.01
        )

    def test_should_handle_zero_duration_stages_gracefully(self):
        """Zero or near-zero duration stages should work."""
        collector = MetricsCollector()
        collector.start_stage()
        elapsed = collector.end_conversion()
        assert elapsed >= 0

    def test_mark_started_sets_iso_timestamp(self):
        """mark_started should set ISO format timestamp."""
        collector = MetricsCollector()
        collector.mark_started()
        assert collector._metrics.started_at is not None
        assert "T" in collector._metrics.started_at
        assert collector._metrics.started_at.endswith("+00:00")

    def test_mark_completed_sets_iso_timestamp(self):
        """mark_completed should set ISO format timestamp."""
        collector = MetricsCollector()
        collector.mark_completed()
        assert collector._metrics.completed_at is not None
        assert "T" in collector._metrics.completed_at

    def test_to_dict_includes_all_timing_fields(self):
        """to_dict should include all timing metrics."""
        collector = MetricsCollector()
        collector._metrics.timing.conversion_time_ms = 100
        collector._metrics.timing.chunking_time_ms = 50
        collector._metrics.timing.embedding_time_ms = 150
        result = collector.to_dict()
        assert result["conversionTimeMs"] == 100
        assert result["chunkingTimeMs"] == 50
        assert result["embeddingTimeMs"] == 150
        assert result["totalTimeMs"] == 300

    def test_to_dict_includes_all_size_fields(self):
        """to_dict should include size metrics."""
        collector = MetricsCollector()
        collector.set_size_metrics(2048, 1500)
        result = collector.to_dict()
        assert result["rawSizeBytes"] == 2048
        assert result["markdownSizeChars"] == 1500

    def test_to_dict_includes_all_chunking_fields(self):
        """to_dict should include chunking metrics."""
        collector = MetricsCollector()
        collector._metrics.chunking.total_chunks = 10
        collector._metrics.chunking.avg_chunk_size = 850.5
        collector._metrics.chunking.oversized_chunks = 2
        result = collector.to_dict()
        assert result["totalChunks"] == 10
        assert result["avgChunkSize"] == 850.5
        assert result["oversizedChunks"] == 2

    def test_to_dict_includes_all_quality_fields(self):
        """to_dict should include quality metrics."""
        collector = MetricsCollector()
        collector._metrics.quality.avg_quality_score = 0.85
        collector._metrics.quality.quality_flags = {"TOO_SHORT": 2}
        collector._metrics.quality.total_tokens = 500
        result = collector.to_dict()
        assert result["avgQualityScore"] == 0.85
        assert result["qualityFlags"] == {"TOO_SHORT": 2}
        assert result["totalTokens"] == 500

    def test_to_dict_includes_timestamps(self):
        """to_dict should include start and completion timestamps."""
        collector = MetricsCollector()
        collector.mark_started()
        collector.mark_completed()
        result = collector.to_dict()
        assert result["startedAt"] is not None
        assert result["completedAt"] is not None


class TestOversizedChunkThreshold:
    """Test the oversized chunk threshold constant."""

    def test_threshold_is_reasonable(self):
        """Threshold should be set to a reasonable value."""
        assert OVERSIZED_CHUNK_THRESHOLD == 1500

    def test_chunks_at_threshold_not_counted(self):
        """Chunks exactly at threshold should not be counted as oversized."""
        chunks = [{"content": "a" * OVERSIZED_CHUNK_THRESHOLD}]
        collector = MetricsCollector()
        collector.set_chunking_metrics(chunks)
        assert collector._metrics.chunking.oversized_chunks == 0

    def test_chunks_over_threshold_counted(self):
        """Chunks over threshold should be counted as oversized."""
        chunks = [{"content": "a" * (OVERSIZED_CHUNK_THRESHOLD + 1)}]
        collector = MetricsCollector()
        collector.set_chunking_metrics(chunks)
        assert collector._metrics.chunking.oversized_chunks == 1
