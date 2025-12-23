# apps/ai-worker/src/config.py
"""
Configuration module for AI Worker.
Uses pydantic-settings for environment variable parsing.
"""

from typing import Literal

from pydantic import field_validator
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
    max_workers: int = (
        1  # Concurrent PDF processing workers (default: 1 for thread-safety)
    )

    @field_validator("max_workers", mode="before")
    @classmethod
    def validate_max_workers(cls, v):
        """Ensure max_workers is at least 1."""
        try:
            val = int(v)
            return max(1, val)
        except (ValueError, TypeError):
            return 1

    # Logging
    log_level: str = "INFO"
    log_format: Literal["json", "console"] = "json"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


settings = Settings()
