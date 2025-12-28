# apps/ai-worker/src/config.py
"""
Configuration module for AI Worker.
Uses pydantic-settings for environment variable parsing.
"""

from typing import Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Callback
    callback_url: str = "http://localhost:3000/internal/callback"

    # OCR
    ocr_enabled: bool = False
    ocr_mode: Literal["auto", "force", "never"] = "auto"
    ocr_languages: str = "en"  # Comma-separated: "en,vi"

    # Processing
    processing_timeout: int = 300  # 5 minutes
    # Note: Concurrency is controlled by BullMQ's PDF_CONCURRENCY env var

    # Embedding
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_dimension: int = 384

    # Chunking
    chunk_size: int = 1000
    chunk_overlap: int = 200

    # Logging
    log_level: str = "INFO"
    log_format: Literal["json", "console"] = "json"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


settings = Settings()
