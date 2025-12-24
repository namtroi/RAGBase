from unittest.mock import MagicMock

import pytest
from src.callback import send_callback
from src.processor import ProcessingResult


@pytest.mark.asyncio
async def test_callback_payload_structure(monkeypatch):
    mock_post = MagicMock()
    mock_post.return_value.status_code = 200
    # Patch AsyncClient.post instead of httpx.post because code uses AsyncClient
    monkeypatch.setattr("httpx.AsyncClient.post", mock_post)

    result = ProcessingResult(
        success=True,
        processed_content="# Markdown",
        chunks=[
            {
                "content": "chunk",
                "index": 0,
                "embedding": [0.1] * 384,
                "metadata": {"charStart": 0, "charEnd": 5},
            }
        ],
        page_count=1,
        processing_time_ms=100,
    )

    await send_callback("doc-123", result)

    assert mock_post.called
    call_args = mock_post.call_args
    assert call_args is not None

    # call_args could be positional or keyword args depending on implementation
    # code: await client.post(settings.callback_url, json=payload)
    # args[0] is url if positional, or kwargs['url']
    kwargs = call_args.kwargs
    payload = kwargs.get("json") or call_args[1]["json"] if len(call_args) > 1 else None

    if payload is None and "json" in kwargs:
        payload = kwargs["json"]

    assert payload["documentId"] == "doc-123"
    assert payload["success"] is True
    assert payload["result"]["processedContent"] == "# Markdown"
    assert len(payload["result"]["chunks"]) == 1
    assert payload["result"]["chunks"][0]["embedding"] == [0.1] * 384


@pytest.mark.asyncio
async def test_callback_failure_structure(monkeypatch):
    mock_post = MagicMock()
    mock_post.return_value.status_code = 200
    monkeypatch.setattr("httpx.AsyncClient.post", mock_post)

    result = ProcessingResult(
        success=False, error_code="ERROR", error_message="message"
    )

    await send_callback("doc-123", result)

    assert mock_post.called
    kwargs = mock_post.call_args.kwargs
    payload = kwargs.get("json")

    assert payload["success"] is False
    assert payload["error"]["code"] == "ERROR"


@pytest.mark.asyncio
async def test_callback_http_error_returns_false(monkeypatch):
    """HTTP 500 error returns False."""
    import httpx

    async def mock_post(*args, **kwargs):
        response = httpx.Response(500, request=httpx.Request("POST", "http://test"))
        raise httpx.HTTPStatusError(
            "Server Error", request=response.request, response=response
        )

    monkeypatch.setattr("httpx.AsyncClient.post", mock_post)

    result = ProcessingResult(success=True, processed_content="test", chunks=[])
    success = await send_callback("doc-123", result)

    assert success is False


@pytest.mark.asyncio
async def test_callback_connection_error_returns_false(monkeypatch):
    """Network connection error returns False."""
    import httpx

    async def mock_post(*args, **kwargs):
        raise httpx.ConnectError("Connection refused")

    monkeypatch.setattr("httpx.AsyncClient.post", mock_post)

    result = ProcessingResult(success=True, processed_content="test", chunks=[])
    success = await send_callback("doc-123", result)

    assert success is False
