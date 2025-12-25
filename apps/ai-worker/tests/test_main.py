# apps/ai-worker/tests/test_main.py
"""
Unit tests for the FastAPI main application.
Tests health, ready, embed, and process endpoints.
"""

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


class TestHealthEndpoint:
    """Tests for the health check endpoint."""

    @pytest.mark.asyncio
    async def test_health_check_returns_ok(self):
        """Test health check returns OK status."""
        from fastapi.testclient import TestClient
        from src.main import app

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
    async def test_readiness_check_always_ready(self):
        """Test readiness always returns ready (HTTP dispatch mode)."""
        from fastapi.testclient import TestClient
        from src.main import app

        with TestClient(app) as client:
            response = client.get("/ready")

            assert response.status_code == 200
            data = response.json()
            assert data["ready"] is True
            assert data["mode"] == "http-dispatch"


class TestProcessEndpoint:
    """Tests for the /process endpoint."""

    @pytest.mark.asyncio
    async def test_process_missing_document_id(self):
        """Test process endpoint requires documentId."""
        from fastapi.testclient import TestClient
        from src.main import app

        with TestClient(app) as client:
            response = client.post("/process", json={"filePath": "/tmp/test.pdf"})

            assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_process_missing_file_path(self):
        """Test process endpoint requires filePath."""
        from fastapi.testclient import TestClient
        from src.main import app

        with TestClient(app) as client:
            response = client.post("/process", json={"documentId": "test-123"})

            assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_process_success(self):
        """Test successful PDF processing."""
        from fastapi.testclient import TestClient
        from src.main import app
        from src.models import ProcessorOutput

        # Mock converter and pipeline
        mock_converter = MagicMock()
        mock_converter.to_markdown = AsyncMock(
            return_value=ProcessorOutput(
                markdown="# Test Document",
                metadata={"ocr_applied": False},
                page_count=1,
            )
        )

        mock_chunks = [
            {"content": "chunk", "index": 0, "embedding": [0.1] * 384, "metadata": {}}
        ]

        with patch("src.main.get_converter", return_value=mock_converter):
            with patch("src.main.processing_pipeline") as mock_pipeline:
                mock_pipeline.run.return_value = mock_chunks
                with patch(
                    "src.main.send_callback", new_callable=AsyncMock, return_value=True
                ):
                    with TestClient(app) as client:
                        response = client.post(
                            "/process",
                            json={
                                "documentId": "test-123",
                                "filePath": "/tmp/test.pdf",
                                "format": "pdf",
                            },
                        )

                        assert response.status_code == 200
                        data = response.json()
                        assert data["status"] == "processed"
                        assert data["documentId"] == "test-123"
                        assert data["success"] is True

    @pytest.mark.asyncio
    async def test_process_callback_failure(self):
        """Test handling of callback failure."""
        from fastapi.testclient import TestClient
        from src.main import app
        from src.models import ProcessorOutput

        mock_converter = MagicMock()
        mock_converter.to_markdown = AsyncMock(
            return_value=ProcessorOutput(markdown="# Test", metadata={}, page_count=1)
        )

        with patch("src.main.get_converter", return_value=mock_converter):
            with patch("src.main.processing_pipeline") as mock_pipeline:
                mock_pipeline.run.return_value = [{"content": "c", "metadata": {}}]
                with patch(
                    "src.main.send_callback", new_callable=AsyncMock, return_value=False
                ):
                    with TestClient(app) as client:
                        response = client.post(
                            "/process",
                            json={
                                "documentId": "test-456",
                                "filePath": "/tmp/test.pdf",
                                "format": "pdf",
                            },
                        )

                        assert response.status_code == 500
                        assert "callback" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_process_unsupported_format(self):
        """Test unsupported format returns 400."""
        from fastapi.testclient import TestClient
        from src.main import app

        with TestClient(app) as client:
            response = client.post(
                "/process",
                json={
                    "documentId": "test-789",
                    "filePath": "/tmp/test.xyz",
                    "format": "xyz",
                },
            )

            assert response.status_code == 400
            assert "unsupported" in response.json()["detail"].lower()


class TestEmbedEndpoint:
    """Tests for the /embed endpoint."""

    @pytest.mark.asyncio
    async def test_embed_success(self):
        """Test successful embedding generation."""
        from fastapi.testclient import TestClient
        from src.main import app

        with patch("src.embedder.Embedder") as MockEmbedder:
            mock_instance = MockEmbedder.return_value
            mock_instance.embed.return_value = [[0.1] * 384, [0.2] * 384]

            with TestClient(app) as client:
                response = client.post(
                    "/embed",
                    json={"texts": ["hello", "world"]},
                )

                assert response.status_code == 200
                data = response.json()
                assert len(data["embeddings"]) == 2
                assert len(data["embeddings"][0]) == 384

    @pytest.mark.asyncio
    async def test_embed_empty_list(self):
        """Test empty input returns empty embeddings."""
        from fastapi.testclient import TestClient
        from src.main import app

        with TestClient(app) as client:
            response = client.post("/embed", json={"texts": []})

            assert response.status_code == 200
            assert response.json()["embeddings"] == []
