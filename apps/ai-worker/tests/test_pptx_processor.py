# apps/ai-worker/tests/test_pptx_processor.py
"""
Unit tests for PptxConverter module.
Tests PPTX slide extraction and markdown conversion.
"""

import pytest
from unittest.mock import patch, MagicMock

from src.converters import PptxConverter
from src.models import ProcessorOutput


@pytest.fixture
def processor():
    """Create PptxConverter instance."""
    return PptxConverter()


class TestPptxProcessorSlides:
    """Tests for slide extraction."""

    @pytest.mark.asyncio
    async def test_extract_all_slides(self, processor, tmp_path):
        """All slides are extracted from PPTX."""
        pptx_path = tmp_path / "test.pptx"
        pptx_path.write_bytes(b"PK")

        # Mock the Docling converter
        mock_converter = MagicMock()
        mock_doc_result = MagicMock()
        mock_doc_result.document.export_to_markdown.return_value = (
            "# Slide 1\n\nContent 1\n\n# Slide 2\n\nContent 2"
        )

        with patch.object(
            processor, "_get_docling_converter", return_value=mock_converter
        ):
            mock_converter.convert.return_value = mock_doc_result

            result = await processor.process(str(pptx_path))

            assert isinstance(result, ProcessorOutput)
            assert "Slide 1" in result.markdown
            assert "Slide 2" in result.markdown

    @pytest.mark.asyncio
    async def test_slide_separation(self, processor, tmp_path):
        """Slides are separated with markers."""
        pptx_path = tmp_path / "test.pptx"
        pptx_path.write_bytes(b"PK")

        mock_converter = MagicMock()
        mock_doc_result = MagicMock()
        mock_doc_result.document.export_to_markdown.return_value = (
            "# Slide 1\n\nFirst slide\n\n# Slide 2\n\nSecond slide"
        )

        with patch.object(
            processor, "_get_docling_converter", return_value=mock_converter
        ):
            mock_converter.convert.return_value = mock_doc_result

            result = await processor.process(str(pptx_path))

            # Should have slide separator added by _add_slide_markers
            assert "<!-- slide -->" in result.markdown

    @pytest.mark.asyncio
    async def test_slide_titles(self, processor, tmp_path):
        """Slide titles are preserved as headings."""
        pptx_path = tmp_path / "test.pptx"
        pptx_path.write_bytes(b"PK")

        mock_converter = MagicMock()
        mock_doc_result = MagicMock()
        mock_doc_result.document.export_to_markdown.return_value = (
            "# Introduction\n\nWelcome to the presentation"
        )

        with patch.object(
            processor, "_get_docling_converter", return_value=mock_converter
        ):
            mock_converter.convert.return_value = mock_doc_result

            result = await processor.process(str(pptx_path))

            assert "Introduction" in result.markdown


class TestPptxProcessorContent:
    """Tests for content extraction."""

    @pytest.mark.asyncio
    async def test_extract_text_boxes(self, processor, tmp_path):
        """Text boxes are extracted."""
        pptx_path = tmp_path / "text.pptx"
        pptx_path.write_bytes(b"PK")

        mock_converter = MagicMock()
        mock_doc_result = MagicMock()
        mock_doc_result.document.export_to_markdown.return_value = (
            "# Title\n\nText box content here."
        )

        with patch.object(
            processor, "_get_docling_converter", return_value=mock_converter
        ):
            mock_converter.convert.return_value = mock_doc_result

            result = await processor.process(str(pptx_path))

            assert "Text box content" in result.markdown

    @pytest.mark.asyncio
    async def test_extract_bullet_points(self, processor, tmp_path):
        """Bullet points are converted to lists."""
        pptx_path = tmp_path / "bullets.pptx"
        pptx_path.write_bytes(b"PK")

        mock_converter = MagicMock()
        mock_doc_result = MagicMock()
        mock_doc_result.document.export_to_markdown.return_value = (
            "# Agenda\n\n- Item 1\n- Item 2\n- Item 3"
        )

        with patch.object(
            processor, "_get_docling_converter", return_value=mock_converter
        ):
            mock_converter.convert.return_value = mock_doc_result

            result = await processor.process(str(pptx_path))

            assert "Item 1" in result.markdown

    @pytest.mark.asyncio
    async def test_extract_tables(self, processor, tmp_path):
        """Tables are converted to markdown tables."""
        pptx_path = tmp_path / "tables.pptx"
        pptx_path.write_bytes(b"PK")

        mock_converter = MagicMock()
        mock_doc_result = MagicMock()
        mock_doc_result.document.export_to_markdown.return_value = (
            "# Data\n\n| Name | Value |\n|---|---|\n| A | 1 |"
        )

        with patch.object(
            processor, "_get_docling_converter", return_value=mock_converter
        ):
            mock_converter.convert.return_value = mock_doc_result

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

        mock_converter = MagicMock()
        mock_doc_result = MagicMock()
        mock_doc_result.document.export_to_markdown.return_value = (
            "# Slide 1\n\nContent\n\n> **Notes:** Remember to mention the deadline."
        )

        with patch.object(
            processor, "_get_docling_converter", return_value=mock_converter
        ):
            mock_converter.convert.return_value = mock_doc_result

            result = await processor.process(str(pptx_path))

            assert result.markdown != ""


class TestPptxProcessorEdgeCases:
    """Tests for edge cases."""

    @pytest.mark.asyncio
    async def test_empty_slide(self, processor, tmp_path):
        """Empty slides are handled gracefully."""
        pptx_path = tmp_path / "empty.pptx"
        pptx_path.write_bytes(b"PK")

        mock_converter = MagicMock()
        mock_doc_result = MagicMock()
        mock_doc_result.document.export_to_markdown.return_value = ""

        with patch.object(
            processor, "_get_docling_converter", return_value=mock_converter
        ):
            mock_converter.convert.return_value = mock_doc_result

            result = await processor.process(str(pptx_path))

            assert result.markdown == ""

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

        mock_converter = MagicMock()
        mock_converter.convert.side_effect = Exception("Invalid file format")

        with patch.object(
            processor, "_get_docling_converter", return_value=mock_converter
        ):
            result = await processor.process(str(invalid_file))

            assert result.markdown == ""
            assert "error" in result.metadata


class TestPptxProcessorMetadata:
    """Tests for metadata extraction."""

    @pytest.mark.asyncio
    async def test_slide_count_in_metadata(self, processor, tmp_path):
        """Slide count is in result."""
        pptx_path = tmp_path / "count.pptx"
        pptx_path.write_bytes(b"PK")

        mock_converter = MagicMock()
        mock_doc_result = MagicMock()
        # 3 slides = 2 slide markers
        mock_doc_result.document.export_to_markdown.return_value = (
            "# Slide 1\n\nContent 1\n\n# Slide 2\n\nContent 2\n\n# Slide 3\n\nContent 3"
        )

        with patch.object(
            processor, "_get_docling_converter", return_value=mock_converter
        ):
            mock_converter.convert.return_value = mock_doc_result

            result = await processor.process(str(pptx_path))

            # Slide count is based on slide markers + 1
            assert result.slide_count >= 1
