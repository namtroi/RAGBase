# apps/ai-worker/tests/test_callback.py
"""
Unit tests for the callback sender module.
"""

import pytest
import httpx
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock

# Import from parent directory
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.callback import send_callback
from src.processor import ProcessingResult


class TestSendCallback:
    """Tests for the send_callback function."""

    @pytest.mark.asyncio
    async def test_send_success_callback(self):
        """Test sending a successful processing callback."""
        result = ProcessingResult(
            success=True,
            markdown="# Test Document\n\nContent here.",
            page_count=3,
            ocr_applied=False,
            processing_time_ms=1500,
        )

        with patch("src.callback.httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client

            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.raise_for_status = MagicMock()
            mock_client.post.return_value = mock_response

            success = await send_callback("doc-123", result)

            assert success is True
            mock_client.post.assert_called_once()

            # Verify payload structure
            call_kwargs = mock_client.post.call_args.kwargs
            payload = call_kwargs["json"]
            assert payload["documentId"] == "doc-123"
            assert payload["success"] is True
            assert payload["result"]["markdown"] == "# Test Document\n\nContent here."
            assert payload["result"]["pageCount"] == 3
            assert payload["result"]["ocrApplied"] is False
            assert payload["result"]["processingTimeMs"] == 1500

    @pytest.mark.asyncio
    async def test_send_failure_callback(self):
        """Test sending a failure callback."""
        result = ProcessingResult(
            success=False,
            error_code="PASSWORD_PROTECTED",
            error_message="PDF is password protected. Remove password and re-upload.",
        )

        with patch("src.callback.httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client

            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.raise_for_status = MagicMock()
            mock_client.post.return_value = mock_response

            success = await send_callback("doc-456", result)

            assert success is True

            # Verify payload structure
            call_kwargs = mock_client.post.call_args.kwargs
            payload = call_kwargs["json"]
            assert payload["documentId"] == "doc-456"
            assert payload["success"] is False
            assert payload["error"]["code"] == "PASSWORD_PROTECTED"
            assert "password protected" in payload["error"]["message"].lower()

    @pytest.mark.asyncio
    async def test_callback_http_error(self):
        """Test handling HTTP errors from the callback endpoint."""
        result = ProcessingResult(success=True, markdown="# Test")

        with patch("src.callback.httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client

            mock_request = MagicMock(spec=httpx.Request)
            mock_response = MagicMock(spec=httpx.Response)
            mock_response.status_code = 500

            mock_client.post.side_effect = httpx.HTTPStatusError(
                "Server error",
                request=mock_request,
                response=mock_response,
            )

            success = await send_callback("doc-789", result)

            assert success is False

    @pytest.mark.asyncio
    async def test_callback_connection_error(self):
        """Test handling connection errors."""
        result = ProcessingResult(success=True, markdown="# Test")

        with patch("src.callback.httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client

            mock_client.post.side_effect = httpx.ConnectError("Connection refused")

            success = await send_callback("doc-999", result)

            assert success is False

    @pytest.mark.asyncio
    async def test_callback_timeout_error(self):
        """Test handling timeout errors."""
        result = ProcessingResult(success=True, markdown="# Test")

        with patch("src.callback.httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client

            mock_client.post.side_effect = httpx.TimeoutException("Request timed out")

            success = await send_callback("doc-timeout", result)

            assert success is False


class TestCallbackPayloadStructure:
    """Tests for callback payload structure validation."""

    @pytest.mark.asyncio
    async def test_success_payload_has_all_fields(self):
        """Test that success payload contains all required fields."""
        result = ProcessingResult(
            success=True,
            markdown="# Doc",
            page_count=1,
            ocr_applied=True,
            processing_time_ms=500,
        )

        with patch("src.callback.httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client

            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.raise_for_status = MagicMock()
            mock_client.post.return_value = mock_response

            await send_callback("doc-id", result)

            payload = mock_client.post.call_args.kwargs["json"]

            # Required top-level fields
            assert "documentId" in payload
            assert "success" in payload
            assert "result" in payload

            # Required result fields
            assert "markdown" in payload["result"]
            assert "pageCount" in payload["result"]
            assert "ocrApplied" in payload["result"]
            assert "processingTimeMs" in payload["result"]

    @pytest.mark.asyncio
    async def test_failure_payload_has_all_fields(self):
        """Test that failure payload contains all required fields."""
        result = ProcessingResult(
            success=False,
            error_code="CORRUPT_FILE",
            error_message="File is corrupted",
        )

        with patch("src.callback.httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client

            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.raise_for_status = MagicMock()
            mock_client.post.return_value = mock_response

            await send_callback("doc-id", result)

            payload = mock_client.post.call_args.kwargs["json"]

            # Required top-level fields
            assert "documentId" in payload
            assert "success" in payload
            assert "error" in payload

            # Required error fields
            assert "code" in payload["error"]
            assert "message" in payload["error"]
