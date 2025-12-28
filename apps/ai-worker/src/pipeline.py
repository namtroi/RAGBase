# apps/ai-worker/src/pipeline.py
"""Centralized processing pipeline: chunk → quality → embed."""

import time
from typing import Any, Dict, List, Optional, Tuple

from .chunkers.document_chunker import DocumentChunker
from .chunkers.presentation_chunker import PresentationChunker
from .chunkers.tabular_chunker import TabularChunker
from .embedder import Embedder
from .logging_config import get_logger
from .models import ProfileConfig
from .quality.analyzer import QualityAnalyzer

logger = get_logger(__name__)


class ProcessingPipeline:
    """
    Unified processing pipeline for all document formats.
    Handles: sanitization → chunking → quality analysis → embedding.

    Accepts ProfileConfig to customize chunking and quality parameters.
    """

    def __init__(self, config: Optional[ProfileConfig] = None):
        """Initialize pipeline with optional profile configuration."""
        self.config = config or ProfileConfig()

        # Initialize chunkers with config values
        self.document_chunker = DocumentChunker(
            chunk_size=self.config.documentChunkSize,
            chunk_overlap=self.config.documentChunkOverlap,
        )
        self.presentation_chunker = PresentationChunker(
            min_chunk_size=self.config.presentationMinChunk,
        )
        self.tabular_chunker = TabularChunker(
            rows_per_chunk=self.config.tabularRowsPerChunk,
        )

        # Initialize analyzer with config values
        self.analyzer = QualityAnalyzer(
            min_chars=self.config.qualityMinChars,
            max_chars=self.config.qualityMaxChars,
            penalty_per_flag=self.config.qualityPenaltyPerFlag,
        )

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


def create_pipeline(config: Optional[ProfileConfig] = None) -> ProcessingPipeline:
    """Factory function to create a pipeline with optional config."""
    return ProcessingPipeline(config)


# Default singleton instance for backward compatibility
processing_pipeline = ProcessingPipeline()
