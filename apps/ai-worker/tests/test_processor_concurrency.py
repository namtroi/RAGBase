# tests/test_processor_concurrency.py
"""
Tests for PDF processor concurrency configuration.
TDD: These tests are written before implementation.
"""

import asyncio
import os
from unittest.mock import MagicMock, patch

import pytest


class TestConcurrencyConfig:
    """Tests for MAX_WORKERS environment configuration."""

    def test_max_workers_default_is_1(self):
        """MAX_WORKERS defaults to 1 when not set."""
        with patch.dict(os.environ, {}, clear=True):
            # Force reimport to pick up env change
            from importlib import reload

            from src import config

            reload(config)

            assert config.settings.max_workers == 1

    def test_max_workers_from_env(self):
        """MAX_WORKERS can be configured via environment."""
        with patch.dict(os.environ, {"MAX_WORKERS": "4"}):
            from importlib import reload

            from src import config

            reload(config)

            assert config.settings.max_workers == 4

    def test_max_workers_invalid_defaults_to_1(self):
        """Invalid MAX_WORKERS value defaults to 1."""
        with patch.dict(os.environ, {"MAX_WORKERS": "invalid"}):
            from importlib import reload

            from src import config

            reload(config)

            assert config.settings.max_workers == 1

    def test_max_workers_zero_defaults_to_1(self):
        """MAX_WORKERS=0 defaults to 1 (minimum)."""
        with patch.dict(os.environ, {"MAX_WORKERS": "0"}):
            from importlib import reload

            from src import config

            reload(config)

            assert config.settings.max_workers == 1


class TestProcessorConcurrency:
    """Tests for processor concurrent execution."""

    @pytest.mark.asyncio
    async def test_concurrent_requests_dont_crash(self):
        """Multiple concurrent requests should not crash due to thread-safety."""
        from src.processor import PDFProcessor

        processor = PDFProcessor()

        # Mock the converter to avoid actual PDF processing
        mock_result = MagicMock()
        mock_result.document.export_to_markdown.return_value = "# Test"
        mock_result.document.pages = [MagicMock()]

        with patch.object(processor, "_get_converter") as mock_get_conv:
            mock_converter = MagicMock()
            mock_converter.convert.return_value = mock_result
            mock_get_conv.return_value = mock_converter

            with patch.object(processor, "_is_password_protected", return_value=False):
                with patch("pathlib.Path.exists", return_value=True):
                    # Create multiple concurrent tasks
                    tasks = [
                        processor.process("/tmp/test1.pdf"),
                        processor.process("/tmp/test2.pdf"),
                        processor.process("/tmp/test3.pdf"),
                    ]

                    # Should complete without crashing
                    results = await asyncio.gather(*tasks)

                    assert len(results) == 3
                    assert all(r.success for r in results)

    @pytest.mark.asyncio
    async def test_semaphore_limits_parallel_processing(self):
        """Only MAX_WORKERS requests should be processed in parallel."""
        from src.processor import PDFProcessor

        processor = PDFProcessor()

        # Track concurrent executions using thread-safe counter
        import threading

        concurrent_count = 0
        max_concurrent = 0
        count_lock = threading.Lock()

        def slow_convert(*args):
            """Sync converter that tracks concurrent calls."""
            nonlocal concurrent_count, max_concurrent

            import time

            with count_lock:
                concurrent_count += 1
                max_concurrent = max(max_concurrent, concurrent_count)

            time.sleep(0.05)  # Simulate processing time

            with count_lock:
                concurrent_count -= 1

            result = MagicMock()
            result.document.export_to_markdown.return_value = "# Test"
            result.document.pages = [MagicMock()]
            return result

        with patch.object(processor, "_is_password_protected", return_value=False):
            with patch("pathlib.Path.exists", return_value=True):
                with patch.object(processor, "_get_converter") as mock_conv:
                    mock_converter = MagicMock()
                    mock_converter.convert = slow_convert
                    mock_conv.return_value = mock_converter

                    # Set MAX_WORKERS=2 for this processor instance
                    processor._semaphore = asyncio.Semaphore(2)

                    # Run 5 concurrent tasks
                    tasks = [processor.process(f"/tmp/test{i}.pdf") for i in range(5)]

                    await asyncio.gather(*tasks)

                    # Max concurrent should not exceed semaphore limit (2)
                    assert max_concurrent <= 2
                    assert max_concurrent >= 1  # At least 1 should run
