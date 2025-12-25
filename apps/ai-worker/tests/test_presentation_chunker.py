# apps/ai-worker/tests/test_presentation_chunker.py
"""
Unit tests for PresentationChunker.
Tests slide-based splitting and grouping of small slides.
"""

import pytest
from src.chunkers.presentation_chunker import PresentationChunker


@pytest.fixture
def chunker():
    """Create a PresentationChunker instance."""
    return PresentationChunker(min_chunk_size=200)


class TestPresentationChunker:
    """Tests for PresentationChunker class."""

    def test_split_by_slide_marker(self, chunker):
        """Test splitting by <!-- slide --> markers."""
        chunker.min_chunk_size = 0  # Force split
        text = "Slide 1 content<!-- slide -->Slide 2 content"
        chunks = chunker.chunk(text)

        assert len(chunks) == 2
        assert chunks[0]["content"] == "Slide 1 content"
        assert chunks[1]["content"] == "Slide 2 content"
        assert chunks[0]["metadata"]["location"]["slide_number"] == 1
        assert chunks[1]["metadata"]["location"]["slide_number"] == 2

    def test_group_small_slides(self, chunker):
        """Test that small slides are grouped with the next slide."""
        # Slide 1 is very short, should be merged with Slide 2
        text = (
            "Short Slide<!-- slide -->Longer Slide 2 with a lot of content that is definitely more than two hundred characters long so that it will trigger the chunk emission immediately after being added to the current accumulation buffer in the chunker logic. "
            * 5
        )
        chunks = chunker.chunk(text)

        # Now each "Longer Slide" is > 200, so each [short, long] pair will be 1 chunk.
        # Plus the last trailing short slide if the pattern doesn't end with a long one.
        # Actually our string is (S1<!-- slide -->L2) * 5.
        # Slidrs: S1, L2S1, L2S1, L2S1, L2S1, L2
        # i=0: sum=S1.
        # i=1: sum=S1+L2S1. Emits.
        # i=2: sum=L2S1. Emits.
        # i=3: sum=L2S1. Emits.
        # i=4: sum=L2S1. Emits.
        # i=5: sum=L2. Emits.
        assert len(chunks) == 5
        assert "Short Slide" in chunks[0]["content"]
        assert "Longer Slide 2" in chunks[0]["content"]
        # Slide numbers should reflect the group
        assert chunks[0]["metadata"]["location"]["slide_numbers"] == [1, 2]

    def test_no_group_large_slides(self, chunker):
        """Test that large slides are not grouped."""
        large_content = "Content " * 50  # > 200 chars
        text = f"{large_content}<!-- slide -->{large_content}"
        chunks = chunker.chunk(text)

        assert len(chunks) == 2
        assert chunks[0]["metadata"]["location"]["slide_number"] == 1
        assert chunks[1]["metadata"]["location"]["slide_number"] == 2

    def test_empty_slides(self, chunker):
        """Test that empty slides (whitespace only) are ignored or handled."""
        chunker.min_chunk_size = 0  # Force split
        text = "Content<!-- slide -->   <!-- slide -->More Content"
        chunks = chunker.chunk(text)

        assert len(chunks) == 2
        assert chunks[0]["content"] == "Content"
        assert chunks[1]["content"] == "More Content"

    def test_single_slide(self, chunker):
        """Test a single slide without markers."""
        text = "Only one slide."
        chunks = chunker.chunk(text)
        assert len(chunks) == 1
        assert chunks[0]["metadata"]["location"]["slide_number"] == 1

    def test_location_metadata_consistency(self, chunker):
        """Test that location metadata is present and correct."""
        text = "S1<!-- slide -->S2<!-- slide -->S3"
        # Since these are all short (< 200), they should all be grouped into one
        chunks = chunker.chunk(text)

        assert len(chunks) == 1
        assert chunks[0]["metadata"]["location"]["slide_numbers"] == [1, 2, 3]
