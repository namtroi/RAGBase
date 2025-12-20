# apps/ai-worker/src/main.py
"""
FastAPI application entry point for AI Worker.
Provides health checks and runs BullMQ consumer.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI

from .config import settings
from .consumer import document_worker
from .logging_config import configure_logging, get_logger

# Configure logging first
configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info("application_starting")
    await document_worker.start()

    yield

    # Shutdown
    logger.info("application_stopping")
    await document_worker.stop()


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
    """Readiness check - verifies worker is running."""
    worker_running = document_worker.is_running
    return {
        "ready": worker_running,
        "worker_active": worker_running,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
