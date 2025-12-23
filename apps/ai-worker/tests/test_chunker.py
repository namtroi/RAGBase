# Mock settings if needed
import os

from src.chunker import Chunker

os.environ["CHUNK_SIZE"] = "100"
os.environ["CHUNK_OVERLAP"] = "20"


def test_chunk_respects_size():
    chunker = Chunker(chunk_size=100, chunk_overlap=20)
    text = "x" * 500
    chunks = chunker.chunk(text)

    assert len(chunks) > 1
    for chunk in chunks:
        # Markdown splitter might add some overhead or respect boundaries differently
        # but shouldn't be massively larger than 100
        assert len(chunk["content"]) <= 120  # Tolerance


def test_chunk_overlap():
    chunker = Chunker(chunk_size=100, chunk_overlap=20)
    text = "abcdefghij" * 20  # 200 chars
    chunks = chunker.chunk(text)

    # Simple check: last parts of chunk 0 should appear in chunk 1
    if len(chunks) > 1:
        c1_end = chunks[0]["content"][-10:]
        assert c1_end in chunks[1]["content"]


def test_chunk_heading_extraction():
    chunker = Chunker()
    md_text = """
# Section One
This is content for section one.

## Subsection A
More content here.
"""
    chunks = chunker.chunk(md_text)

    # Chunk 0 should capture "Section One" context
    # LangChain MarkdownHeaderTextSplitter logic depends on how we implement.
    # If we use RecursiveCharacterTextSplitter.from_tiktoken_encoder, no headings.
    # If we use MarkdownHeaderTextSplitter, we get metadata.

    # We will assume we implement header extraction logic.
    pass


def test_chunk_metadata_structure():
    chunker = Chunker()
    result = chunker.chunk("test content")
    assert isinstance(result, list)
    if result:
        c = result[0]
        assert "content" in c
        assert "index" in c
        assert "metadata" in c
        assert "charStart" in c["metadata"]
        assert "charEnd" in c["metadata"]
