# apps/ai-worker/src/hybrid_embedder.py
"""
HybridEmbedder: Dense + Sparse vector generation.

Phase 5: Uses fastembed for both dense (BGE) and sparse (BM25) embeddings.
Replaces sentence-transformers for unified embedding approach.
"""

from dataclasses import dataclass
from typing import List, Optional

import structlog

logger = structlog.get_logger()


@dataclass
class SparseVector:
    """Sparse vector representation for BM25-style search."""

    indices: List[int]
    values: List[float]


@dataclass
class HybridVector:
    """Combined dense + sparse vector for hybrid search."""

    dense: List[float]  # 384 floats (BGE-small)
    sparse: SparseVector  # Variable length


class HybridEmbedder:
    """
    Generates both dense and sparse embeddings using fastembed.

    - Dense: BAAI/bge-small-en-v1.5 (384 dimensions)
    - Sparse: Qdrant/bm25 (BM25-based sparse vectors)
    """

    _instance: Optional["HybridEmbedder"] = None
    _dense_model = None
    _sparse_model = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._dense_model is None:
            self._load_models()

    def _load_models(self):
        """Load both embedding models."""
        from fastembed import SparseTextEmbedding, TextEmbedding

        logger.info("loading_hybrid_embedding_models")

        # Dense model - same as before (BAAI/bge-small-en-v1.5)
        logger.info("loading_dense_model", model="BAAI/bge-small-en-v1.5")
        self._dense_model = TextEmbedding("BAAI/bge-small-en-v1.5")

        # Sparse model - BM25 for keyword matching
        logger.info("loading_sparse_model", model="Qdrant/bm25")
        self._sparse_model = SparseTextEmbedding("Qdrant/bm25")

        logger.info("hybrid_embedding_models_loaded")

    def embed(self, texts: List[str]) -> List[HybridVector]:
        """
        Generate hybrid (dense + sparse) embeddings for texts.

        Args:
            texts: List of text strings to embed.

        Returns:
            List of HybridVector containing dense and sparse vectors.
        """
        if not texts:
            return []

        try:
            # Generate both embedding types
            dense_embeddings = list(self._dense_model.embed(texts))
            sparse_embeddings = list(self._sparse_model.embed(texts))

            # Combine into HybridVector
            results = []
            for dense, sparse in zip(dense_embeddings, sparse_embeddings):
                results.append(
                    HybridVector(
                        dense=dense.tolist(),
                        sparse=SparseVector(
                            indices=sparse.indices.tolist(),
                            values=sparse.values.tolist(),
                        ),
                    )
                )

            return results

        except Exception as e:
            logger.error("hybrid_embedding_failed", error=str(e))
            raise

    def embed_dense_only(self, texts: List[str]) -> List[List[float]]:
        """
        Generate only dense embeddings (backward compatibility).

        Args:
            texts: List of text strings to embed.

        Returns:
            List of dense vectors (384 floats each).
        """
        if not texts:
            return []

        embeddings = list(self._dense_model.embed(texts))
        return [e.tolist() for e in embeddings]

    def get_token_counts(self, texts: List[str]) -> List[int]:
        """
        Estimate token counts for texts.

        Uses a simple heuristic based on word count.
        For more accurate counts, use the dense model's tokenizer.
        """
        if not texts:
            return []

        # Simple estimation: ~0.75 tokens per word (typical for English)
        # This is faster than loading tokenizer for each call
        counts = []
        for text in texts:
            word_count = len(text.split())
            # Cap at 512 (model max)
            counts.append(min(int(word_count * 1.3), 512))
        return counts


# Singleton instance
_hybrid_embedder: Optional[HybridEmbedder] = None


def get_hybrid_embedder() -> HybridEmbedder:
    """Get singleton HybridEmbedder instance."""
    global _hybrid_embedder
    if _hybrid_embedder is None:
        _hybrid_embedder = HybridEmbedder()
    return _hybrid_embedder
