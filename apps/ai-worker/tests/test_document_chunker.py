# apps/ai-worker/tests/test_document_chunker.py
"""
Unit tests for DocumentChunker.
Tests header-based splitting, breadcrumbs, and fallback behavior.
"""

import pytest
from src.chunkers.document_chunker import DocumentChunker


@pytest.fixture
def chunker():
    """Create a DocumentChunker instance."""
    return DocumentChunker(chunk_size=500, chunk_overlap=50)


class TestDocumentChunker:
    """Tests for DocumentChunker class."""

    def test_split_by_h1(self, chunker):
        """Test splitting by H1 headers."""
        text = "# Section 1\nContent 1\n# Section 2\nContent 2"
        chunks = chunker.chunk(text)

        assert len(chunks) == 2
        assert chunks[0]["content"] == "> Section 1\n\nContent 1"
        assert chunks[0]["metadata"]["breadcrumbs"] == ["Section 1"]
        assert chunks[1]["content"] == "> Section 2\n\nContent 2"
        assert chunks[1]["metadata"]["breadcrumbs"] == ["Section 2"]

    def test_split_by_h2(self, chunker):
        """Test splitting by H2 headers."""
        text = "# Title\n## Subtitle 1\nContent 1\n## Subtitle 2\nContent 2"
        chunks = chunker.chunk(text)

        # Depending on implementation, we might get 2 chunks if Title is small and combined with Subtitle 1
        # or 3 chunks if we split strictly. MarkdownHeaderTextSplitter usually groups content under headers.
        assert len(chunks) >= 2
        # Check if breadcrumbs are correctly nested
        last_chunk = chunks[-1]
        assert "Subtitle 2" in last_chunk["metadata"]["breadcrumbs"]
        assert "Title" in last_chunk["metadata"]["breadcrumbs"]

    def test_breadcrumbs_nested(self, chunker):
        """Test breadcrumb generation for nested sections (H1 > H2 > H3)."""
        text = """
# Heading 1
Intro
## Heading 2
Sub-intro
### Heading 3
Deep content
"""
        chunks = chunker.chunk(text.strip())

        # Find the chunk containing "Deep content"
        deep_chunk = next(c for c in chunks if "Deep content" in c["content"])
        assert deep_chunk["metadata"]["breadcrumbs"] == [
            "Heading 1",
            "Heading 2",
            "Heading 3",
        ]

    def test_fallback_no_headings(self, chunker):
        """Test fallback split when no headings are present."""
        text = "Line 1\n" * 100  # Large text without headings
        chunks = chunker.chunk(text)

        assert len(chunks) > 1
        assert all(c["metadata"]["breadcrumbs"] == [] for c in chunks)

    def test_fallback_large_section(self, chunker):
        """Test fallback split for a large section under a heading."""
        text = "# Large Section\n" + ("Boring content\n" * 100)
        chunks = chunker.chunk(text)

        assert len(chunks) > 1
        assert all("Large Section" in c["metadata"]["breadcrumbs"] for c in chunks)

    def test_empty_text(self, chunker):
        """Test empty string returns no chunks."""
        assert chunker.chunk("") == []
        assert chunker.chunk("   ") == []

    def test_inject_breadcrumb_header(self, chunker):
        """Test that breadcrumbs are injected into the chunk content for context."""
        text = "# Project Alpha\n## Finance\nExpenses are high."
        chunks = chunker.chunk(text)

        # The content should ideally contain some form of breadcrumb reference if configured
        # Or we check if our custom breadcrumb metadata is there.
        assert any("Project Alpha" in c["content"] for c in chunks)
        assert any("Finance" in c["content"] for c in chunks)

    def test_short_text_single_chunk(self, chunker):
        """Test short text remains a single chunk."""
        text = "Simple short text."
        chunks = chunker.chunk(text)
        assert len(chunks) == 1
        assert chunks[0]["content"] == text
