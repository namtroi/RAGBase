# apps/ai-worker/src/pipeline.py
"""Centralized processing pipeline: chunk → quality → embed."""

import time
from typing import Any, Dict, List, Tuple

from .chunkers.document_chunker import DocumentChunker
from .chunkers.presentation_chunker import PresentationChunker
from .chunkers.tabular_chunker import TabularChunker
from .embedder import Embedder
from .logging_config import get_logger
from .quality.analyzer import QualityAnalyzer

logger = get_logger(__name__)


class ProcessingPipeline:
    """
    Unified processing pipeline for all document formats.
    Handles: sanitization → chunking → quality analysis → embedding.
    """

    def __init__(self):
        self.document_chunker = DocumentChunker()
        self.presentation_chunker = PresentationChunker()
        self.tabular_chunker = TabularChunker()
        self.analyzer = QualityAnalyzer()
        self.embedder = Embedder()

    def run(
        self,
        markdown: str,
        category: str = "document",
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Run the full processing pipeline.

        Args:
            markdown: Raw markdown content from converter.
            category: Format category ("document", "presentation", "tabular").

        Returns:
            Tuple of (chunks with embeddings and quality metadata, embedding_time_ms).
        """
        if not markdown or not markdown.strip():
            return [], 0

        # Input is already sanitized and normalized by converter
        # Select chunker based on category
        if category == "presentation":
            chunker = self.presentation_chunker
        elif category == "tabular":
            chunker = self.tabular_chunker
        else:
            chunker = self.document_chunker

        chunks = chunker.chunk(markdown)

        if not chunks:
            return [], 0

        # 3. Analyze quality for each chunk
        for i, chunk in enumerate(chunks):
            quality = self.analyzer.analyze(chunk)
            chunk["metadata"]["qualityScore"] = quality["score"]
            chunk["metadata"]["qualityFlags"] = [f.value for f in quality["flags"]]
            chunk["metadata"]["hasTitle"] = quality["has_title"]
            chunk["metadata"]["completeness"] = quality["completeness"]
            chunk["metadata"]["chunkType"] = category
            chunk["index"] = i

        # 4. Generate embeddings and token counts (with timing)
        texts = [c["content"] for c in chunks]
        embed_start = time.time()
        embeddings = self.embedder.embed(texts)
        token_counts = self.embedder.get_token_counts(texts)
        embedding_time_ms = int((time.time() - embed_start) * 1000)

        for i, chunk in enumerate(chunks):
            chunk["embedding"] = embeddings[i]
            chunk["metadata"]["tokenCount"] = token_counts[i]

        logger.info(
            "pipeline_complete",
            category=category,
            chunks=len(chunks),
            embedding_time_ms=embedding_time_ms,
        )

        return chunks, embedding_time_ms


# Singleton instance for reuse
processing_pipeline = ProcessingPipeline()
