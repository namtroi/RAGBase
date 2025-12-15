# apps/ai-worker/tests/test_main.py
"""
Unit tests for the FastAPI main application.
"""

import pytest
from pathlib import Path
from unittest.mock import patch, AsyncMock

# Import from parent directory
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))


class TestHealthEndpoint:
    """Tests for the health check endpoint."""

    @pytest.mark.asyncio
    async def test_health_check_returns_ok(self):
        """Test health check returns OK status."""
        from fastapi.testclient import TestClient
        from src.main import app

        with patch("src.main.document_worker.start", new_callable=AsyncMock):
            with patch("src.main.document_worker.stop", new_callable=AsyncMock):
                with TestClient(app) as client:
                    response = client.get("/health")

                    assert response.status_code == 200
                    data = response.json()
                    assert data["status"] == "ok"
                    assert data["service"] == "ai-worker"
                    assert "ocr_enabled" in data


class TestReadinessEndpoint:
    """Tests for the readiness check endpoint."""

    @pytest.mark.asyncio
    async def test_readiness_check_worker_not_running(self):
        """Test readiness when worker is not running."""
        from fastapi.testclient import TestClient
        from src.main import app

        with patch("src.main.document_worker.start", new_callable=AsyncMock):
            with patch("src.main.document_worker.stop", new_callable=AsyncMock):
                with patch("src.main.document_worker.is_running", False):
                    with TestClient(app) as client:
                        response = client.get("/ready")

                        assert response.status_code == 200
                        data = response.json()
                        assert data["ready"] is False
                        assert data["worker_active"] is False

    @pytest.mark.asyncio
    async def test_readiness_check_worker_running(self):
        """Test readiness when worker is running."""
        from fastapi.testclient import TestClient
        from src.main import app

        with patch("src.main.document_worker.start", new_callable=AsyncMock):
            with patch("src.main.document_worker.stop", new_callable=AsyncMock):
                with patch("src.main.document_worker.is_running", True):
                    with TestClient(app) as client:
                        response = client.get("/ready")

                        assert response.status_code == 200
                        data = response.json()
                        assert data["ready"] is True
                        assert data["worker_active"] is True
