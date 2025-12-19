# apps/ai-worker/src/config.py
"""
Configuration module for AI Worker.
Uses pydantic-settings for environment variable parsing.
"""

from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Callback
    callback_url: str = "http://localhost:3000/internal/callback"

    # OCR
    ocr_enabled: bool = False
    ocr_mode: Literal["auto", "force", "never"] = "auto"
    ocr_languages: str = "en"  # Comma-separated: "en,vi"

    # Processing
    processing_timeout: int = 300  # 5 minutes

    # Logging
    log_level: str = "INFO"
    log_format: Literal["json", "console"] = "json"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


settings = Settings()
