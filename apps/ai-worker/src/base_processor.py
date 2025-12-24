# apps/ai-worker/src/base_processor.py
"""Base processor with shared chunking and embedding logic."""

from typing import Any, Dict, List
from .chunker import Chunker
from .embedder import Embedder


class BaseProcessor:
    """Base class for document processors."""

    def __init__(self):
        self.chunker = Chunker()
        self.embedder = Embedder()

    def _chunk_and_embed(self, markdown: str) -> List[Dict[str, Any]]:
        """Common logic for chunking markdown and generating embeddings."""
        chunks = self.chunker.chunk(markdown)

        if chunks:
            texts = [c["content"] for c in chunks]
            embeddings = self.embedder.embed(texts)
            for i, chunk in enumerate(chunks):
                chunk["embedding"] = embeddings[i]

        return chunks
