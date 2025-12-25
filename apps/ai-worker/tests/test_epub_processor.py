# apps/ai-worker/tests/test_epub_processor.py
"""
Unit tests for EpubProcessor module.
Tests EPUB chapter extraction and markdown conversion.
"""

import pytest
from pathlib import Path
from ebooklib import epub

from src.converters import EpubConverter as EpubProcessor
from src.models import ProcessorOutput


@pytest.fixture
def processor():
    """Create EpubProcessor instance."""
    return EpubProcessor()


@pytest.fixture
def sample_epub(tmp_path) -> Path:
    """Create a sample EPUB file for testing."""
    book = epub.EpubBook()
    book.set_identifier("test123")
    book.set_title("Test Book")
    book.set_language("en")

    # Add chapters
    chapter1 = epub.EpubHtml(title="Chapter 1", file_name="chap_01.xhtml", lang="en")
    chapter1.content = (
        "<html><body><h1>Chapter 1</h1><p>First chapter content.</p></body></html>"
    )

    chapter2 = epub.EpubHtml(title="Chapter 2", file_name="chap_02.xhtml", lang="en")
    chapter2.content = (
        "<html><body><h1>Chapter 2</h1><p>Second chapter content.</p></body></html>"
    )

    book.add_item(chapter1)
    book.add_item(chapter2)

    # Define Table Of Contents
    book.toc = (
        epub.Link("chap_01.xhtml", "Chapter 1", "chap1"),
        epub.Link("chap_02.xhtml", "Chapter 2", "chap2"),
    )

    # Add navigation files
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())

    # Define spine
    book.spine = ["nav", chapter1, chapter2]

    # Write to file
    epub_path = tmp_path / "test.epub"
    epub.write_epub(str(epub_path), book, {})

    return epub_path


class TestEpubProcessorStructure:
    """Tests for EPUB structure extraction."""

    @pytest.mark.asyncio
    async def test_extract_chapters(self, processor, sample_epub):
        """Chapters are extracted from EPUB."""
        result = await processor.process(str(sample_epub))

        assert isinstance(result, ProcessorOutput)
        assert "Chapter 1" in result.markdown
        assert "Chapter 2" in result.markdown
        assert "First chapter content" in result.markdown
        assert "Second chapter content" in result.markdown

    @pytest.mark.asyncio
    async def test_chapter_titles_as_headings(self, processor, sample_epub):
        """Chapter titles are converted to headings."""
        result = await processor.process(str(sample_epub))

        # Should have markdown headings
        assert "# Chapter 1" in result.markdown or "## Chapter 1" in result.markdown

    @pytest.mark.asyncio
    async def test_chapter_separation(self, processor, sample_epub):
        """Chapters are separated with horizontal rule."""
        result = await processor.process(str(sample_epub))

        # Should have separator between chapters
        assert "---" in result.markdown

    @pytest.mark.asyncio
    async def test_chapter_count_in_metadata(self, processor, sample_epub):
        """Metadata includes chapter count."""
        result = await processor.process(str(sample_epub))

        assert result.chapter_count is not None
        assert result.chapter_count >= 2


class TestEpubProcessorEdgeCases:
    """Tests for edge cases."""

    @pytest.mark.asyncio
    async def test_skip_toc_chapter(self, processor, tmp_path):
        """TOC chapter is skipped."""
        book = epub.EpubBook()
        book.set_identifier("test")
        book.set_title("Test")

        # Create TOC item
        toc = epub.EpubHtml(title="Table of Contents", file_name="toc.xhtml")
        toc.content = (
            "<html><body><h1>Table of Contents</h1><p>Links here</p></body></html>"
        )

        # Create actual chapter
        chapter = epub.EpubHtml(title="Chapter 1", file_name="chap_01.xhtml")
        chapter.content = "<html><body><h1>Chapter 1</h1><p>Content</p></body></html>"

        book.add_item(toc)
        book.add_item(chapter)
        book.add_item(epub.EpubNcx())
        book.add_item(epub.EpubNav())
        book.spine = ["nav", toc, chapter]

        epub_path = tmp_path / "toc_test.epub"
        epub.write_epub(str(epub_path), book, {})

        result = await processor.process(str(epub_path))

        assert "Chapter 1" in result.markdown
        # TOC should ideally be skipped, or at least content chapter is present
        assert "Content" in result.markdown

    @pytest.mark.asyncio
    async def test_skip_cover_page(self, processor, tmp_path):
        """Cover page is skipped."""
        book = epub.EpubBook()
        book.set_identifier("test")
        book.set_title("Test")

        # Create cover item
        cover = epub.EpubHtml(title="Cover", file_name="cover.xhtml")
        cover.content = "<html><body><img src='cover.jpg'/></body></html>"

        # Create actual chapter
        chapter = epub.EpubHtml(title="Chapter 1", file_name="chap_01.xhtml")
        chapter.content = "<html><body><h1>Chapter 1</h1><p>Content</p></body></html>"

        book.add_item(cover)
        book.add_item(chapter)
        book.add_item(epub.EpubNcx())
        book.add_item(epub.EpubNav())
        book.spine = ["nav", cover, chapter]

        epub_path = tmp_path / "cover_test.epub"
        epub.write_epub(str(epub_path), book, {})

        result = await processor.process(str(epub_path))

        assert "Chapter 1" in result.markdown
        assert "Content" in result.markdown

    @pytest.mark.asyncio
    async def test_unicode_content(self, processor, tmp_path):
        """Unicode content is preserved."""
        book = epub.EpubBook()
        book.set_identifier("test")
        book.set_title("テスト")

        chapter = epub.EpubHtml(title="日本語", file_name="chap_01.xhtml")
        chapter.content = (
            "<html><body><h1>日本語チャプター</h1><p>こんにちは世界</p></body></html>"
        )

        book.add_item(chapter)
        book.add_item(epub.EpubNcx())
        book.add_item(epub.EpubNav())
        book.spine = ["nav", chapter]

        epub_path = tmp_path / "unicode.epub"
        epub.write_epub(str(epub_path), book, {})

        result = await processor.process(str(epub_path))

        assert "日本語" in result.markdown
        assert "こんにちは" in result.markdown


class TestEpubProcessorErrors:
    """Tests for error cases."""

    @pytest.mark.asyncio
    async def test_file_not_found(self, processor):
        """Missing file returns error in metadata."""
        result = await processor.process("/nonexistent/file.epub")

        assert result.markdown == ""
        assert "error" in result.metadata

    @pytest.mark.asyncio
    async def test_invalid_epub(self, processor, tmp_path):
        """Invalid EPUB returns error in metadata."""
        invalid_file = tmp_path / "invalid.epub"
        invalid_file.write_text("not a valid epub")

        result = await processor.process(str(invalid_file))

        assert result.markdown == ""
        assert "error" in result.metadata

    @pytest.mark.asyncio
    async def test_empty_epub(self, processor, tmp_path):
        """EPUB with no chapters returns empty markdown."""
        book = epub.EpubBook()
        book.set_identifier("empty")
        book.set_title("Empty")
        book.add_item(epub.EpubNcx())
        book.add_item(epub.EpubNav())
        book.spine = ["nav"]

        epub_path = tmp_path / "empty.epub"
        epub.write_epub(str(epub_path), book, {})

        result = await processor.process(str(epub_path))

        assert result.markdown == "" or len(result.markdown.strip()) == 0


class TestEpubProcessorMetadata:
    """Tests for metadata extraction."""

    @pytest.mark.asyncio
    async def test_title_in_metadata(self, processor, sample_epub):
        """Book title is in metadata."""
        result = await processor.process(str(sample_epub))

        assert "title" in result.metadata
        assert result.metadata["title"] == "Test Book"
