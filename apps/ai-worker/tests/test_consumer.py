# apps/ai-worker/tests/test_consumer.py
"""
Unit tests for the BullMQ consumer module.
"""

import pytest
from pathlib import Path
from unittest.mock import patch, AsyncMock

# Import from parent directory
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.consumer import process_job, DocumentWorker
from src.processor import ProcessingResult


class MockJob:
    """Mock BullMQ job for testing."""

    def __init__(self, job_id: str, data: dict):
        self.id = job_id
        self.data = data


class TestProcessJob:
    """Tests for the process_job function."""

    @pytest.mark.asyncio
    async def test_process_pdf_job_success(self):
        """Test successful PDF job processing."""
        job = MockJob(
            "job-123",
            {
                "documentId": "doc-abc",
                "filePath": "/tmp/test.pdf",
                "format": "pdf",
                "config": {"ocrMode": "auto"},
            },
        )

        mock_result = ProcessingResult(
            success=True,
            markdown="# Test",
            page_count=2,
            processing_time_ms=1000,
        )

        with patch("src.consumer.pdf_processor.process", new_callable=AsyncMock) as mock_process:
            mock_process.return_value = mock_result

            with patch("src.consumer.send_callback", new_callable=AsyncMock) as mock_callback:
                mock_callback.return_value = True

                result = await process_job(job, "token")

                assert result["success"] is True
                assert result["documentId"] == "doc-abc"
                assert result["processingTimeMs"] == 1000

                mock_process.assert_called_once_with("/tmp/test.pdf", "auto")
                mock_callback.assert_called_once_with("doc-abc", mock_result)

    @pytest.mark.asyncio
    async def test_process_non_pdf_job_skipped(self):
        """Test that non-PDF jobs are skipped."""
        job = MockJob(
            "job-456",
            {
                "documentId": "doc-def",
                "filePath": "/tmp/test.txt",
                "format": "txt",
            },
        )

        result = await process_job(job, "token")

        assert result["skipped"] is True
        assert result["reason"] == "non-pdf format"

    @pytest.mark.asyncio
    async def test_process_job_callback_failure(self):
        """Test handling callback failure."""
        job = MockJob(
            "job-789",
            {
                "documentId": "doc-ghi",
                "filePath": "/tmp/test.pdf",
                "format": "pdf",
            },
        )

        mock_result = ProcessingResult(success=True, markdown="# Test")

        with patch("src.consumer.pdf_processor.process", new_callable=AsyncMock) as mock_process:
            mock_process.return_value = mock_result

            with patch("src.consumer.send_callback", new_callable=AsyncMock) as mock_callback:
                mock_callback.return_value = False

                with pytest.raises(Exception) as exc_info:
                    await process_job(job, "token")

                assert "Failed to send callback" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_process_job_uses_default_ocr_mode(self):
        """Test that default OCR mode is used when not specified."""
        job = MockJob(
            "job-default",
            {
                "documentId": "doc-default",
                "filePath": "/tmp/test.pdf",
                "format": "pdf",
                "config": {},  # No ocrMode specified
            },
        )

        mock_result = ProcessingResult(success=True, markdown="# Test")

        with patch("src.consumer.pdf_processor.process", new_callable=AsyncMock) as mock_process:
            mock_process.return_value = mock_result

            with patch("src.consumer.send_callback", new_callable=AsyncMock) as mock_callback:
                mock_callback.return_value = True

                await process_job(job, "token")

                # Should use "auto" as default
                mock_process.assert_called_once_with("/tmp/test.pdf", "auto")


class TestDocumentWorker:
    """Tests for the DocumentWorker class."""

    def test_worker_initial_state(self):
        """Test worker is not running initially."""
        worker = DocumentWorker()
        assert worker.worker is None
        assert worker.is_running is False

    @pytest.mark.asyncio
    async def test_worker_start_without_bullmq(self):
        """Test worker handles missing bullmq gracefully."""
        worker = DocumentWorker()

        # Mock the bullmq import to raise ImportError
        import builtins
        real_import = builtins.__import__

        def mock_import(name, *args, **kwargs):
            if name == "bullmq":
                raise ImportError("No module named 'bullmq'")
            return real_import(name, *args, **kwargs)

        with patch.object(builtins, "__import__", side_effect=mock_import):
            # Should not raise, just log warning
            await worker.start()

        assert worker.is_running is False

    @pytest.mark.asyncio
    async def test_worker_stop_when_not_started(self):
        """Test stopping a worker that was never started."""
        worker = DocumentWorker()

        # Should not raise
        await worker.stop()

        assert worker.is_running is False
