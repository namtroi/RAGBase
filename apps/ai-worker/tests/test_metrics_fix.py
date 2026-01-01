import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from src.main import process_document, ProcessRequest


# Mock classes to avoid full dependency chain
class MockOutput:
    markdown = "test markdown"
    page_count = 1
    slide_count = None
    sheet_count = None
    chapter_count = None
    metadata = {}

    # Add an async mock for methods if needed, but to_markdown returns this object


@pytest.mark.asyncio
async def test_chunking_time_calculation():
    """
    Test that chunking time is correctly calculated by subtracting
    embedding time from total pipeline time.
    """
    # Mock dependencies
    mock_pipeline = MagicMock()
    # Simulate: chunks returned, embedding took 100ms
    # pipeline.run is SYNC
    mock_pipeline.run.return_value = ([{"content": "chunk", "metadata": {}}], 100)

    mock_converter = MagicMock()
    # converter.to_markdown is ASYNC
    mock_converter.to_markdown = AsyncMock(return_value=MockOutput())

    # Simulate pipeline.run taking 150ms total (so chunking should be ~50ms)
    # We patch time.time to control execution duration

    # We need to capture the result passed to send_callback
    # send_callback is ASYNC
    mock_send_callback = AsyncMock(return_value=True)

    with patch("src.main.get_converter", return_value=mock_converter), patch(
        "src.main.get_pdf_converter", return_value=mock_converter
    ), patch("src.main.get_category", return_value="document"), patch(
        "src.main.create_pipeline", return_value=mock_pipeline
    ), patch(
        "src.main.send_callback", mock_send_callback
    ), patch(
        "src.main.os.path.exists", return_value=False
    ), patch(
        "src.main.time.time"
    ) as mock_time_main, patch(
        "src.metrics.time.time"
    ) as mock_time_metrics:

        # Sync the times for main and metrics
        # Simplified time flow matching the logic:
        # 1. Start process: 1000
        # 2. Conversion Start: 1000
        # 3. Conversion End: 1010
        # 4. Pipeline Start: 1010
        # 5. Pipeline End: 1160 (Total 150ms)
        # 6. Process End: 1160

        # NOTE: time.time() returns seconds.
        # 150ms = 0.150s
        # 10ms = 0.010s

        time_side_effect = [
            1000.000,  # main: start_time
            1000.000,  # metrics: start_stage (conversion)
            1000.010,  # metrics: end_conversion (10ms)
            1000.010,  # metrics: start_stage (chunking)
            1000.160,  # metrics: end_chunking (150ms elapsed)
            1000.160,  # main: total_time
        ]

        iterator = iter(time_side_effect)
        mock_time_main.side_effect = iterator
        mock_time_metrics.side_effect = iterator

        request = ProcessRequest(
            documentId="test-doc", filePath="test.pdf", format="pdf"
        )

        await process_document(request)

        # Verify call to send_callback
        mock_send_callback.assert_called_once()
        call_args = mock_send_callback.call_args
        result = call_args[0][1]  # Second arg is ProcessingResult

        metrics = result.metrics

        if result.metrics is None:
            pytest.fail(f"Metrics is None. Result: {result}")

        # Verify Timing with tolerance (+/- 1ms)
        assert metrics["embeddingTimeMs"] == 100

        # Total Pipeline: 150ms. Embedding: 100ms. Chunking: 50ms.
        assert abs(metrics["chunkingTimeMs"] - 50) <= 1

        # Conversion: 10ms
        assert abs(metrics["conversionTimeMs"] - 10) <= 1
