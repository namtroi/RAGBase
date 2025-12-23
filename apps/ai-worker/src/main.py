# apps/ai-worker/src/main.py
"""
FastAPI application entry point for AI Worker.
Provides health checks and /process endpoint for PDF processing.
"""

from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .callback import send_callback
from .config import settings
from .logging_config import configure_logging, get_logger
from .processor import pdf_processor

# Configure logging first
configure_logging()
logger = get_logger(__name__)


# Request/Response models
class ProcessConfig(BaseModel):
    ocrMode: str = "auto"
    ocrLanguages: List[str] = ["en"]


class ProcessRequest(BaseModel):
    documentId: str
    filePath: str
    config: Optional[ProcessConfig] = None


class ProcessResponse(BaseModel):
    status: str
    documentId: str
    success: bool
    processingTimeMs: Optional[int] = None
    error: Optional[str] = None


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


class EmbedRequest(BaseModel):
    texts: List[str]


class EmbedResponse(BaseModel):
    embeddings: List[List[float]]


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

        # Process the PDF
        result = await pdf_processor.process(request.filePath, ocr_mode)

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
