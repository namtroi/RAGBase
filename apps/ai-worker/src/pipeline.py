# apps/ai-worker/src/pipeline.py
"""Centralized processing pipeline: chunk → quality → embed."""

import time
from typing import Any, Dict, List, Optional, Tuple

from .chunkers.document_chunker import DocumentChunker
from .chunkers.presentation_chunker import PresentationChunker
from .chunkers.tabular_chunker import TabularChunker
from .hybrid_embedder import HybridEmbedder
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
            header_levels=self.config.documentHeaderLevels,
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
            ideal_length=self.config.documentChunkSize,
            penalty_per_flag=self.config.qualityPenaltyPerFlag,
        )

        # Phase 5: Hybrid embedder (dense + sparse)
        self.embedder = HybridEmbedder()

    def _strip_breadcrumb_prefix(self, content: str) -> str:
        """Remove breadcrumb prefix (> Chapter > Section) from content."""
        lines = content.split("\n")
        if lines and lines[0].startswith(">"):
            # Skip breadcrumb line and any following empty lines
            start = 1
            while start < len(lines) and not lines[start].strip():
                start += 1
            return "\n".join(lines[start:])
        return content

    def merge_small_chunks(
        self, chunks: List[Dict[str, Any]], min_chars: int, max_chars: int
    ) -> List[Dict[str, Any]]:
        """
        Optimally merge small chunks using greedy accumulator algorithm.

        Goals:
        - Maximize number of normal-sized chunks (>= min_chars)
        - Never exceed max_chars
        - Preserve document order

        Args:
            chunks: List of chunks with content and metadata.
            min_chars: Minimum chars for a chunk to be considered complete.
            max_chars: Maximum chars allowed per chunk.
        """
        if len(chunks) <= 1:
            return chunks

        result: List[Dict[str, Any]] = []
        # Accumulator for small chunks
        acc_content: str = ""
        acc_metadata: Optional[Dict[str, Any]] = None

        for chunk in chunks:
            content = chunk.get("content", "")
            content_len = len(content)
            acc_len = len(acc_content)

            # Case 1: Normal-sized chunk
            if content_len >= min_chars:
                if acc_len > 0:
                    # Try to prepend accumulator to this chunk
                    combined_len = acc_len + 2 + content_len  # +2 for "\n\n"
                    if combined_len <= max_chars:
                        # Fits! Prepend accumulator
                        chunk["content"] = acc_content + "\n\n" + content
                        result.append(chunk)
                    else:
                        # Doesn't fit. Flush accumulator separately first.
                        if acc_len >= min_chars:
                            # Accumulator is big enough on its own
                            result.append(
                                {
                                    "content": acc_content,
                                    "metadata": acc_metadata or {"breadcrumbs": []},
                                }
                            )
                        elif result:
                            # Try append to previous chunk
                            prev_len = len(result[-1]["content"])
                            if prev_len + 2 + acc_len <= max_chars:
                                result[-1]["content"] += "\n\n" + acc_content
                            else:
                                # Can't fit anywhere, keep as undersized chunk
                                result.append(
                                    {
                                        "content": acc_content,
                                        "metadata": acc_metadata or {"breadcrumbs": []},
                                    }
                                )
                        else:
                            # No previous chunk, keep as undersized
                            result.append(
                                {
                                    "content": acc_content,
                                    "metadata": acc_metadata or {"breadcrumbs": []},
                                }
                            )
                        result.append(chunk)
                    # Reset accumulator
                    acc_content = ""
                    acc_metadata = None
                else:
                    # No accumulator, just add chunk
                    result.append(chunk)

            # Case 2: Small chunk → accumulate
            else:
                stripped = self._strip_breadcrumb_prefix(content)
                if not stripped.strip():
                    continue

                if acc_len == 0:
                    # Start new accumulator
                    acc_content = stripped
                    acc_metadata = chunk.get("metadata", {}).copy()
                else:
                    # Try to add to accumulator
                    combined_len = acc_len + 2 + len(stripped)
                    if combined_len <= max_chars:
                        acc_content += "\n\n" + stripped
                    else:
                        # Would exceed max. Flush accumulator first.
                        if acc_len >= min_chars:
                            result.append(
                                {
                                    "content": acc_content,
                                    "metadata": acc_metadata or {"breadcrumbs": []},
                                }
                            )
                        elif result:
                            prev_len = len(result[-1]["content"])
                            if prev_len + 2 + acc_len <= max_chars:
                                result[-1]["content"] += "\n\n" + acc_content
                            else:
                                result.append(
                                    {
                                        "content": acc_content,
                                        "metadata": acc_metadata or {"breadcrumbs": []},
                                    }
                                )
                        else:
                            result.append(
                                {
                                    "content": acc_content,
                                    "metadata": acc_metadata or {"breadcrumbs": []},
                                }
                            )
                        # Start new accumulator with current small chunk
                        acc_content = stripped
                        acc_metadata = chunk.get("metadata", {}).copy()

                # Check if accumulator reached min_chars → flush as complete chunk
                if len(acc_content) >= min_chars:
                    result.append(
                        {
                            "content": acc_content,
                            "metadata": acc_metadata or {"breadcrumbs": []},
                        }
                    )
                    acc_content = ""
                    acc_metadata = None

        # Handle leftover accumulator
        if acc_content:
            acc_len = len(acc_content)
            if acc_len >= min_chars:
                result.append(
                    {
                        "content": acc_content,
                        "metadata": acc_metadata or {"breadcrumbs": []},
                    }
                )
            elif result:
                prev_len = len(result[-1]["content"])
                if prev_len + 2 + acc_len <= max_chars:
                    result[-1]["content"] += "\n\n" + acc_content
                else:
                    result.append(
                        {
                            "content": acc_content,
                            "metadata": acc_metadata or {"breadcrumbs": []},
                        }
                    )
            else:
                result.append(
                    {
                        "content": acc_content,
                        "metadata": acc_metadata or {"breadcrumbs": []},
                    }
                )

        # Re-index chunks after merge
        for i, chunk in enumerate(result):
            if "metadata" not in chunk:
                chunk["metadata"] = {}
            chunk["metadata"]["index"] = i

        return result

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

        # 2. Merge small chunks when autoFix enabled
        if self.config.autoFixEnabled:
            original_count = len(chunks)
            chunks = self.merge_small_chunks(
                chunks,
                self.config.qualityMinChars,
                self.config.qualityMaxChars,
            )
            if len(chunks) < original_count:
                logger.info(
                    "chunks_merged",
                    original=original_count,
                    merged=len(chunks),
                    min_chars=self.config.qualityMinChars,
                    max_chars=self.config.qualityMaxChars,
                )

        # 3. Analyze quality for each chunk
        for i, chunk in enumerate(chunks):
            quality = self.analyzer.analyze(chunk)
            chunk["metadata"]["qualityScore"] = quality["score"]
            chunk["metadata"]["qualityFlags"] = [f.value for f in quality["flags"]]
            chunk["metadata"]["hasTitle"] = quality["has_title"]
            chunk["metadata"]["completeness"] = quality["completeness"]
            chunk["metadata"]["chunkType"] = category
            chunk["index"] = i

        # 4. Generate hybrid embeddings and token counts (with timing)
        texts = [c["content"] for c in chunks]
        embed_start = time.time()
        hybrid_vectors = self.embedder.embed(texts)
        token_counts = self.embedder.get_token_counts(texts)
        embedding_time_ms = int((time.time() - embed_start) * 1000)

        for i, chunk in enumerate(chunks):
            # Phase 5: Hybrid vector format for Qdrant
            chunk["vector"] = {
                "dense": hybrid_vectors[i].dense,
                "sparse": {
                    "indices": hybrid_vectors[i].sparse.indices,
                    "values": hybrid_vectors[i].sparse.values,
                },
            }
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
