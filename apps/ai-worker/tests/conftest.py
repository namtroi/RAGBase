# apps/ai-worker/tests/conftest.py
"""
Pytest fixtures for AI Worker tests.
"""

import pytest
from pathlib import Path


@pytest.fixture
def fixtures_dir() -> Path:
    """Return the fixtures directory path."""
    return Path(__file__).parent / "fixtures"


@pytest.fixture
def sample_pdf_path(fixtures_dir: Path) -> Path:
    """Return the sample PDF path."""
    return fixtures_dir / "sample.pdf"


@pytest.fixture
def mock_settings(monkeypatch):
    """Mock settings for testing."""
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379")
    monkeypatch.setenv("CALLBACK_URL", "http://localhost:3000/internal/callback")
    monkeypatch.setenv("OCR_ENABLED", "false")
    monkeypatch.setenv("LOG_FORMAT", "console")
