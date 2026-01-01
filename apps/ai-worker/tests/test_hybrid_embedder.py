# apps/ai-worker/tests/test_hybrid_embedder.py
"""Tests for HybridEmbedder (Phase 5: Dense + Sparse vectors)."""

import pytest


class TestHybridEmbedder:
    """Test suite for HybridEmbedder functionality."""

    @pytest.fixture(scope="class")
    def embedder(self):
        """Get singleton HybridEmbedder instance."""
        from src.hybrid_embedder import HybridEmbedder

        return HybridEmbedder()

    def test_embed_returns_dense_384_dimensions(self, embedder):
        """Dense vector should be 384 dimensions (BGE-small)."""
        texts = ["This is a test sentence."]
        results = embedder.embed(texts)

        assert len(results) == 1
        assert len(results[0].dense) == 384
        # All values should be floats
        assert all(isinstance(v, float) for v in results[0].dense)

    def test_embed_returns_sparse_indices_and_values(self, embedder):
        """Sparse vector should have indices and values arrays."""
        texts = ["Test document with keywords."]
        results = embedder.embed(texts)

        assert len(results) == 1
        sparse = results[0].sparse

        # Sparse vector should have non-empty indices and values
        assert len(sparse.indices) > 0
        assert len(sparse.values) > 0
        assert len(sparse.indices) == len(sparse.values)

        # Indices should be integers, values should be floats
        assert all(isinstance(i, int) for i in sparse.indices)
        assert all(isinstance(v, float) for v in sparse.values)

    def test_sparse_indices_are_positive_integers(self, embedder):
        """Sparse indices should be non-negative integers."""
        texts = ["Document with various technical terms and keywords."]
        results = embedder.embed(texts)

        indices = results[0].sparse.indices
        # All indices should be non-negative integers
        assert all(isinstance(i, int) and i >= 0 for i in indices)

    def test_embed_batch_returns_correct_count(self, embedder):
        """Batch embedding should return correct number of vectors."""
        texts = [
            "First document.",
            "Second document with more content.",
            "Third document.",
        ]
        results = embedder.embed(texts)

        assert len(results) == 3
        for result in results:
            assert len(result.dense) == 384
            assert len(result.sparse.indices) > 0

    def test_empty_input_returns_empty_list(self, embedder):
        """Empty input should return empty list."""
        results = embedder.embed([])
        assert results == []

    def test_embed_dense_only_returns_list_of_floats(self, embedder):
        """embed_dense_only should return List[List[float]]."""
        texts = ["Test sentence."]
        results = embedder.embed_dense_only(texts)

        assert len(results) == 1
        assert len(results[0]) == 384
        assert all(isinstance(v, float) for v in results[0])

    def test_get_token_counts_returns_estimates(self, embedder):
        """Token count estimation should return reasonable values."""
        texts = [
            "Short.",
            "This is a medium length sentence with more words.",
            "This is a longer paragraph with many more words that would likely have a higher token count when processed by the model.",
        ]
        counts = embedder.get_token_counts(texts)

        assert len(counts) == 3
        assert all(isinstance(c, int) for c in counts)
        # Longer text should have higher count
        assert counts[0] < counts[1] < counts[2]
        # All counts should be reasonable (< 512 cap)
        assert all(c <= 512 for c in counts)

    def test_embed_handles_unicode(self, embedder):
        """Should handle unicode characters correctly."""
        texts = ["日本語テスト with émojis 🔐 and special chars"]
        results = embedder.embed(texts)

        assert len(results) == 1
        assert len(results[0].dense) == 384

    def test_hybrid_vector_structure(self, embedder):
        """HybridVector should have correct structure."""
        from src.hybrid_embedder import HybridVector, SparseVector

        texts = ["Test structure."]
        results = embedder.embed(texts)

        assert isinstance(results[0], HybridVector)
        assert isinstance(results[0].sparse, SparseVector)
        assert hasattr(results[0], "dense")
        assert hasattr(results[0].sparse, "indices")
        assert hasattr(results[0].sparse, "values")
