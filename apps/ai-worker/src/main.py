# apps/ai-worker/src/main.py
"""
FastAPI application entry point for AI Worker.
Provides health checks and /process endpoint for PDF processing.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from .callback import send_callback
from .config import settings
from .logging_config import configure_logging, get_logger
from .models import (
    EmbedRequest,
    EmbedResponse,
    ProcessRequest,
    ProcessResponse,
)
from .processor import pdf_processor
from .text_processor import text_processor

# Configure logging first
configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info("application_starting")
    logger.info("http_server_ready")  # No queue worker needed - using HTTP dispatch

    yield

    # Shutdown
    logger.info("application_stopping")


app = FastAPI(
    title="RAGBase AI Worker",
    description="PDF processing worker using Docling",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "ai-worker",
        "ocr_enabled": settings.ocr_enabled,
    }


@app.get("/ready")
async def readiness_check():
    """Readiness check - HTTP server is ready."""
    return {
        "ready": True,
        "mode": "http-dispatch",
    }


@app.post("/embed", response_model=EmbedResponse)
async def embed_texts(request: EmbedRequest):
    """
    Generate embeddings for a list of texts.
    Used by backend for query embedding.
    """
    from .embedder import Embedder

    if not request.texts:
        return EmbedResponse(embeddings=[])

    try:
        embedder = Embedder()
        embeddings = embedder.embed(request.texts)
        return EmbedResponse(embeddings=embeddings)
    except Exception as e:
        logger.exception("embed_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/process", response_model=ProcessResponse)
async def process_document(request: ProcessRequest):
    """
    Process a PDF document dispatched from the backend.

    This endpoint is called by the Node.js backend when a PDF job
    needs to be processed. After processing, a callback is sent
    to the backend with the results.
    """
    logger.info(
        "process_request_received",
        document_id=request.documentId,
        file_path=request.filePath,
    )

    try:
        # Get OCR mode from config
        ocr_mode = "auto"
        if request.config:
            ocr_mode = request.config.ocrMode

        # Route to appropriate processor based on format
        file_format = request.format.lower()

        if file_format == "pdf":
            # PDF uses Docling
            result = await pdf_processor.process(request.filePath, ocr_mode)
        else:
            # Text files (md, txt, json) use TextProcessor
            result = await text_processor.process(request.filePath, file_format)

        # Send callback to backend
        callback_success = await send_callback(request.documentId, result)

        if not callback_success:
            logger.error(
                "callback_failed",
                document_id=request.documentId,
            )
            raise HTTPException(
                status_code=500,
                detail=f"Failed to send callback for {request.documentId}",
            )

        logger.info(
            "process_completed",
            document_id=request.documentId,
            success=result.success,
            time_ms=result.processing_time_ms,
        )

        return ProcessResponse(
            status="processed",
            documentId=request.documentId,
            success=result.success,
            processingTimeMs=result.processing_time_ms,
            error=result.error_message if not result.success else None,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            "process_error",
            document_id=request.documentId,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=str(e),
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
