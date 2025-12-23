from typing import List

import structlog
from sentence_transformers import SentenceTransformer

from src.config import settings

logger = structlog.get_logger()


class Embedder:
    _instance = None
    _model = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Embedder, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        # Allow re-initialization check to be safe in singleton pattern if called multiple times
        if self._model is None:
            logger.info("loading_embedding_model", model=settings.embedding_model)
            self._model = SentenceTransformer(settings.embedding_model)
            logger.info("embedding_model_loaded")

    def embed(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        try:
            # normalize_embeddings=True is usually good for cosine similarity
            # but let's stick to default or minimal first. BGE models often expect instruction
            # for queries, but for docs/passage it's just raw text.
            embeddings = self._model.encode(texts, normalize_embeddings=True)
            return embeddings.tolist()
        except Exception as e:
            logger.error("embedding_failed", error=str(e))
            raise e
