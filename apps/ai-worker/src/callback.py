# apps/ai-worker/src/callback.py
"""
HTTP callback sender for notifying Node.js backend of processing results.
"""

import httpx

from .config import settings
from .logging_config import get_logger
from .processor import ProcessingResult

logger = get_logger(__name__)


async def send_callback(
    document_id: str,
    result: ProcessingResult,
) -> bool:
    """Send processing result to Node.js backend."""

    if result.success:
        payload = {
            "documentId": document_id,
            "success": True,
            "result": {
                "markdown": result.markdown,
                "pageCount": result.page_count,
                "ocrApplied": result.ocr_applied,
                "processingTimeMs": result.processing_time_ms,
            },
        }
    else:
        payload = {
            "documentId": document_id,
            "success": False,
            "error": {
                "code": result.error_code,
                "message": result.error_message,
            },
        }

    try:
        # Increased timeout for large documents (482 pages can have huge markdown)
        timeout = httpx.Timeout(
            connect=10.0,
            read=120.0,   # 2 minutes for response
            write=120.0,  # 2 minutes for sending large payload
            pool=10.0,
        )
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                settings.callback_url,
                json=payload,
            )
            response.raise_for_status()

            logger.info(
                "callback_sent",
                document_id=document_id,
                success=result.success,
                status_code=response.status_code,
            )
            return True

    except httpx.HTTPStatusError as e:
        logger.error(
            "callback_failed",
            document_id=document_id,
            status_code=e.response.status_code,
            error=str(e),
        )
        return False

    except Exception as e:
        logger.exception(
            "callback_error",
            document_id=document_id,
            error=str(e),
        )
        return False
