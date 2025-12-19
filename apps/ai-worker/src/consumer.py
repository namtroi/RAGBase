# apps/ai-worker/src/consumer.py
"""
BullMQ job consumer for processing document jobs.
"""

import asyncio
from typing import Any, Dict, Optional

from .config import settings
from .processor import pdf_processor
from .callback import send_callback
from .logging_config import get_logger

logger = get_logger(__name__)


async def process_job(job: Any, token: str) -> Dict[str, Any]:
    """Process a document processing job."""

    document_id = job.data.get("documentId")
    file_path = job.data.get("filePath")
    file_format = job.data.get("format")
    config = job.data.get("config", {})

    logger.info(
        "job_started",
        job_id=job.id,
        document_id=document_id,
        format=file_format,
    )

    # Only process PDFs in Python worker
    if file_format != "pdf":
        logger.warning(
            "skipping_non_pdf",
            job_id=job.id,
            format=file_format,
        )
        return {"skipped": True, "reason": "non-pdf format"}

    # Process the PDF
    ocr_mode = config.get("ocrMode", "auto")
    result = await pdf_processor.process(file_path, ocr_mode)

    # Send callback to Node.js
    callback_success = await send_callback(document_id, result)

    if not callback_success:
        raise Exception(f"Failed to send callback for {document_id}")

    logger.info(
        "job_completed",
        job_id=job.id,
        document_id=document_id,
        success=result.success,
    )

    return {
        "success": result.success,
        "documentId": document_id,
        "processingTimeMs": result.processing_time_ms,
    }


class DocumentWorker:
    """BullMQ worker for processing document jobs."""

    def __init__(self):
        self.worker: Optional[Any] = None
        self._running = False

    async def start(self):
        """Start the BullMQ worker."""
        try:
            from bullmq import Worker

            logger.info("worker_starting", redis_url=settings.redis_url)

            self.worker = Worker(
                name="document-processing",
                processor=process_job,
                opts={
                    "connection": settings.redis_url,
                    "concurrency": 5,
                },
            )

            self._running = True

            # Event handlers
            @self.worker.on("completed")
            def on_completed(job, result):
                logger.info("job_event_completed", job_id=job.id)

            @self.worker.on("failed")
            def on_failed(job, error):
                logger.error("job_event_failed", job_id=job.id, error=str(error))

            @self.worker.on("error")
            def on_error(error):
                logger.error("worker_error", error=str(error))

            logger.info("worker_started")

        except ImportError:
            logger.warning(
                "bullmq_not_available",
                reason="bullmq package not installed, running in API-only mode",
            )
            self._running = False

    async def stop(self):
        """Stop the BullMQ worker."""
        if self.worker:
            await self.worker.close()
            self._running = False
            logger.info("worker_stopped")

    @property
    def is_running(self) -> bool:
        """Check if the worker is currently running."""
        return self._running


# Singleton instance
document_worker = DocumentWorker()
