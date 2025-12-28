# apps/ai-worker/tests/test_profile_config.py
"""Tests for ProfileConfig model and pipeline integration."""

import pytest
from src.models import ProfileConfig
from src.pipeline import create_pipeline
from src.quality.analyzer import QualityAnalyzer


class TestProfileConfigModel:
    """Test ProfileConfig model defaults and parsing."""

    def test_default_values(self):
        """ProfileConfig should have correct defaults matching database schema."""
        config = ProfileConfig()

        # Conversion defaults
        assert config.conversionTableRows == 35
        assert config.conversionTableCols == 20
        assert config.pdfOcrMode == "auto"
        assert config.pdfOcrLanguages == "en"
        assert config.pdfNumThreads == 4
        assert config.pdfTableStructure is False

        # Chunking defaults
        assert config.documentChunkSize == 1000
        assert config.documentChunkOverlap == 100
        assert config.documentHeaderLevels == 3
        assert config.presentationMinChunk == 200
        assert config.tabularRowsPerChunk == 20

        # Quality defaults
        assert config.qualityMinChars == 50
        assert config.qualityMaxChars == 2000
        assert config.qualityPenaltyPerFlag == 0.15
        assert config.autoFixEnabled is True
        assert config.autoFixMaxPasses == 2

    def test_custom_values(self):
        """ProfileConfig should accept custom values."""
        config = ProfileConfig(
            documentChunkSize=500,
            documentChunkOverlap=50,
            pdfOcrMode="force",
            qualityMinChars=100,
        )

        assert config.documentChunkSize == 500
        assert config.documentChunkOverlap == 50
        assert config.pdfOcrMode == "force"
        assert config.qualityMinChars == 100

    def test_ocr_languages_list_single(self):
        """Single language should parse correctly."""
        config = ProfileConfig(pdfOcrLanguages="en")
        assert config.ocr_languages_list == ["en"]

    def test_ocr_languages_list_multiple(self):
        """Multiple languages should parse correctly."""
        config = ProfileConfig(pdfOcrLanguages="en,vi,ja")
        assert config.ocr_languages_list == ["en", "vi", "ja"]

    def test_ocr_languages_list_with_spaces(self):
        """Languages with spaces should be trimmed."""
        config = ProfileConfig(pdfOcrLanguages=" en , vi , ja ")
        assert config.ocr_languages_list == ["en", "vi", "ja"]


class TestPipelineWithConfig:
    """Test ProcessingPipeline uses ProfileConfig correctly."""

    def test_pipeline_uses_chunk_size_from_config(self):
        """Pipeline should use chunk size from config."""
        config = ProfileConfig(documentChunkSize=500)
        pipeline = create_pipeline(config)

        assert pipeline.document_chunker.chunk_size == 500

    def test_pipeline_uses_chunk_overlap_from_config(self):
        """Pipeline should use chunk overlap from config."""
        config = ProfileConfig(documentChunkOverlap=75)
        pipeline = create_pipeline(config)

        assert pipeline.document_chunker.chunk_overlap == 75

    def test_pipeline_uses_quality_config(self):
        """Pipeline should pass quality settings to analyzer."""
        config = ProfileConfig(
            qualityMinChars=100,
            qualityMaxChars=3000,
            qualityPenaltyPerFlag=0.2,
        )
        pipeline = create_pipeline(config)

        assert pipeline.analyzer.min_chars == 100
        assert pipeline.analyzer.max_chars == 3000
        assert pipeline.analyzer.penalty_per_flag == 0.2

    def test_pipeline_uses_presentation_config(self):
        """Pipeline should use presentation chunker config."""
        config = ProfileConfig(presentationMinChunk=300)
        pipeline = create_pipeline(config)

        assert pipeline.presentation_chunker.min_chunk_size == 300

    def test_pipeline_uses_tabular_config(self):
        """Pipeline should use tabular chunker config."""
        config = ProfileConfig(tabularRowsPerChunk=30)
        pipeline = create_pipeline(config)

        assert pipeline.tabular_chunker.rows_per_chunk == 30

    def test_pipeline_default_config(self):
        """Pipeline should use defaults when no config provided."""
        pipeline = create_pipeline()

        assert pipeline.document_chunker.chunk_size == 1000
        assert pipeline.document_chunker.chunk_overlap == 100


class TestQualityAnalyzerWithConfig:
    """Test QualityAnalyzer uses config parameters."""

    def test_custom_min_chars(self):
        """Analyzer should use custom min_chars threshold."""
        analyzer = QualityAnalyzer(min_chars=100)

        # 80 chars should be TOO_SHORT with 100 min
        chunk = {"content": "x" * 80, "metadata": {}}
        result = analyzer.analyze(chunk)
        assert "TOO_SHORT" in [f.value for f in result["flags"]]

        # 120 chars should not be TOO_SHORT
        chunk = {"content": "x" * 120, "metadata": {}}
        result = analyzer.analyze(chunk)
        assert "TOO_SHORT" not in [f.value for f in result["flags"]]

    def test_custom_max_chars(self):
        """Analyzer should use custom max_chars threshold."""
        analyzer = QualityAnalyzer(max_chars=500)

        # 600 chars should be TOO_LONG with 500 max
        chunk = {"content": "x" * 600, "metadata": {}}
        result = analyzer.analyze(chunk)
        assert "TOO_LONG" in [f.value for f in result["flags"]]

    def test_custom_penalty(self):
        """Analyzer should use custom penalty_per_flag."""
        analyzer = QualityAnalyzer(penalty_per_flag=0.25)

        # A short chunk (30 chars < 50 min) without context will have:
        # - TOO_SHORT flag
        # - NO_CONTEXT flag (no heading/breadcrumbs)
        # - FRAGMENT flag (doesn't end with sentence ender)
        # Score = max(0.0, 1.0 - (3 flags * 0.25)) = 0.25
        chunk = {"content": "x" * 30, "metadata": {}}
        result = analyzer.analyze(chunk)
        assert result["score"] == pytest.approx(0.25, abs=0.01)
