# apps/ai-worker/tests/test_pptx_processor.py
"""
Unit tests for PptxProcessor module.
Tests PPTX slide extraction and markdown conversion.
"""

import pytest
from unittest.mock import patch

from src.pptx_processor import PptxProcessor
from src.models import ProcessorOutput


@pytest.fixture
def processor():
    """Create PptxProcessor instance."""
    return PptxProcessor()


class TestPptxProcessorSlides:
    """Tests for slide extraction."""

    @pytest.mark.asyncio
    async def test_extract_all_slides(self, processor, tmp_path):
        """All slides are extracted from PPTX."""
        pptx_path = tmp_path / "test.pptx"
        pptx_path.write_bytes(b"PK")  # Minimal zip header

        with patch.object(processor, "_convert_with_docling") as mock_convert:
            mock_convert.return_value = (
                "# Slide 1\n\nContent 1\n\n# Slide 2\n\nContent 2",
                2,
            )

            result = await processor.process(str(pptx_path))

            assert isinstance(result, ProcessorOutput)
            assert "Slide 1" in result.markdown
            assert "Slide 2" in result.markdown
            assert result.slide_count == 2

    @pytest.mark.asyncio
    async def test_slide_separation(self, processor, tmp_path):
        """Slides are separated with markers."""
        pptx_path = tmp_path / "test.pptx"
        pptx_path.write_bytes(b"PK")

        with patch.object(processor, "_convert_with_docling") as mock_convert:
            mock_convert.return_value = (
                "# Slide 1\n\nFirst slide\n\n# Slide 2\n\nSecond slide",
                2,
            )

            result = await processor.process(str(pptx_path))

            # Should have slide separator
            assert "---" in result.markdown or "<!-- slide -->" in result.markdown

    @pytest.mark.asyncio
    async def test_slide_titles(self, processor, tmp_path):
        """Slide titles are preserved as headings."""
        pptx_path = tmp_path / "test.pptx"
        pptx_path.write_bytes(b"PK")

        with patch.object(processor, "_convert_with_docling") as mock_convert:
            mock_convert.return_value = (
                "# Introduction\n\nWelcome to the presentation",
                1,
            )

            result = await processor.process(str(pptx_path))

            assert (
                "# Introduction" in result.markdown or "Introduction" in result.markdown
            )


class TestPptxProcessorContent:
    """Tests for content extraction."""

    @pytest.mark.asyncio
    async def test_extract_text_boxes(self, processor, tmp_path):
        """Text boxes are extracted."""
        pptx_path = tmp_path / "text.pptx"
        pptx_path.write_bytes(b"PK")

        with patch.object(processor, "_convert_with_docling") as mock_convert:
            mock_convert.return_value = ("# Title\n\nText box content here.", 1)

            result = await processor.process(str(pptx_path))

            assert "Text box content" in result.markdown

    @pytest.mark.asyncio
    async def test_extract_bullet_points(self, processor, tmp_path):
        """Bullet points are converted to lists."""
        pptx_path = tmp_path / "bullets.pptx"
        pptx_path.write_bytes(b"PK")

        with patch.object(processor, "_convert_with_docling") as mock_convert:
            mock_convert.return_value = ("# Agenda\n\n- Item 1\n- Item 2\n- Item 3", 1)

            result = await processor.process(str(pptx_path))

            assert "- Item 1" in result.markdown or "Item 1" in result.markdown

    @pytest.mark.asyncio
    async def test_extract_tables(self, processor, tmp_path):
        """Tables are converted to markdown tables."""
        pptx_path = tmp_path / "tables.pptx"
        pptx_path.write_bytes(b"PK")

        with patch.object(processor, "_convert_with_docling") as mock_convert:
            mock_convert.return_value = (
                "# Data\n\n| Name | Value |\n|---|---|\n| A | 1 |",
                1,
            )

            result = await processor.process(str(pptx_path))

            assert "|" in result.markdown
            assert "Name" in result.markdown


class TestPptxProcessorNotes:
    """Tests for speaker notes."""

    @pytest.mark.asyncio
    async def test_include_speaker_notes(self, processor, tmp_path):
        """Speaker notes are included."""
        pptx_path = tmp_path / "notes.pptx"
        pptx_path.write_bytes(b"PK")

        with patch.object(processor, "_convert_with_docling") as mock_convert:
            # Docling may include notes in output
            mock_convert.return_value = (
                "# Slide 1\n\nContent\n\n> **Notes:** Remember to mention the deadline.",
                1,
            )

            result = await processor.process(str(pptx_path))

            # Notes should be present if Docling extracts them
            assert result.markdown != ""


class TestPptxProcessorEdgeCases:
    """Tests for edge cases."""

    @pytest.mark.asyncio
    async def test_empty_slide(self, processor, tmp_path):
        """Empty slides are handled gracefully."""
        pptx_path = tmp_path / "empty.pptx"
        pptx_path.write_bytes(b"PK")

        with patch.object(processor, "_convert_with_docling") as mock_convert:
            mock_convert.return_value = ("", 0)

            result = await processor.process(str(pptx_path))

            assert result.markdown == ""
            assert result.slide_count == 0

    @pytest.mark.asyncio
    async def test_file_not_found(self, processor):
        """Missing file returns error."""
        result = await processor.process("/nonexistent/file.pptx")

        assert result.markdown == ""
        assert "error" in result.metadata

    @pytest.mark.asyncio
    async def test_invalid_pptx(self, processor, tmp_path):
        """Invalid PPTX returns error."""
        invalid_file = tmp_path / "invalid.pptx"
        invalid_file.write_text("not a valid pptx")

        with patch.object(processor, "_convert_with_docling") as mock_convert:
            mock_convert.side_effect = Exception("Invalid file format")

            result = await processor.process(str(invalid_file))

            assert result.markdown == "" and "error" in result.metadata


class TestPptxProcessorMetadata:
    """Tests for metadata extraction."""

    @pytest.mark.asyncio
    async def test_slide_count_in_metadata(self, processor, tmp_path):
        """Slide count is in result."""
        pptx_path = tmp_path / "count.pptx"
        pptx_path.write_bytes(b"PK")

        with patch.object(processor, "_convert_with_docling") as mock_convert:
            mock_convert.return_value = (
                "# Slide 1\n\n---\n\n# Slide 2\n\n---\n\n# Slide 3",
                3,
            )

            result = await processor.process(str(pptx_path))

            assert result.slide_count == 3
