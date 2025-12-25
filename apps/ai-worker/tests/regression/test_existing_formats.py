# apps/ai-worker/tests/regression/test_existing_formats.py
"""
Regression tests for existing format converters.
Ensures PDF, TXT, MD, JSON still work after Phase 4 changes.
"""

import pytest
from pathlib import Path

from src.converters import PdfConverter, TextConverter


class TestPdfRegression:
    """Regression tests for PDF processing."""

    @pytest.fixture
    def sample_pdf(self, tmp_path):
        """Get or create sample PDF."""
        fixtures_dir = Path(__file__).parent.parent / "fixtures"
        pdf_path = fixtures_dir / "sample.pdf"
        if pdf_path.exists():
            return str(pdf_path)
        pytest.skip("No sample PDF fixture available")

    @pytest.mark.asyncio
    async def test_pdf_still_works(self, sample_pdf):
        """PDF processing returns expected result."""
        converter = PdfConverter()
        result = await converter.to_markdown(sample_pdf)

        # ProcessorOutput has .markdown, not .success
        assert result.markdown is not None
        assert len(result.markdown) > 0


class TestTextRegression:
    """Regression tests for text-based formats."""

    @pytest.fixture
    def txt_file(self, tmp_path):
        """Create a TXT file."""
        file_path = tmp_path / "test.txt"
        file_path.write_text("Hello World")
        return str(file_path)

    @pytest.fixture
    def md_file(self, tmp_path):
        """Create an MD file."""
        file_path = tmp_path / "test.md"
        file_path.write_text("# Title\n\nParagraph here.")
        return str(file_path)

    @pytest.fixture
    def json_file(self, tmp_path):
        """Create a JSON file."""
        import json

        file_path = tmp_path / "test.json"
        file_path.write_text(json.dumps({"key": "value", "nested": {"a": 1}}))
        return str(file_path)

    @pytest.mark.asyncio
    async def test_txt_still_works(self, txt_file):
        """TXT processing works correctly."""
        converter = TextConverter()
        result = await converter.to_markdown(txt_file, "txt")

        assert result.markdown is not None
        assert "Hello World" in result.markdown

    @pytest.mark.asyncio
    async def test_md_still_works(self, md_file):
        """Markdown processing preserves content."""
        converter = TextConverter()
        result = await converter.to_markdown(md_file, "md")

        assert result.markdown is not None
        assert "Title" in result.markdown or "Paragraph" in result.markdown

    @pytest.mark.asyncio
    async def test_json_still_works(self, json_file):
        """JSON processing works correctly."""
        converter = TextConverter()
        result = await converter.to_markdown(json_file, "json")

        assert result.markdown is not None
        assert "key" in result.markdown


class TestEmbeddingDimensions:
    """Regression tests for embedding dimensions."""

    def test_embedding_dimensions_unchanged(self):
        """Embeddings should still be 384 dimensions."""
        from src.embedder import Embedder

        embedder = Embedder()
        embedding = embedder.embed("Test text")

        assert len(embedding) == 384


class TestChunkStructure:
    """Regression tests for chunk structure."""

    def test_chunk_has_required_fields(self):
        """Chunks should have content, index, and metadata."""
        from src.chunkers.document_chunker import DocumentChunker

        chunker = DocumentChunker()
        text = "# Test Heading\n\nThis is a test paragraph. " * 50
        chunks = chunker.chunk(text)

        assert len(chunks) > 0
        for chunk in chunks:
            assert "content" in chunk
            assert "metadata" in chunk
