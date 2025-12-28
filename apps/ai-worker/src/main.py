# apps/ai-worker/src/main.py
"""
FastAPI application entry point for AI Worker.
Provides health checks, /embed and /process endpoints.
"""

import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from .callback import send_callback
from .config import settings
from .logging_config import configure_logging, get_logger
from .metrics import MetricsCollector
from .models import (
    EmbedRequest,
    EmbedResponse,
    ProcessRequest,
    ProcessResponse,
    ProcessingResult,
    ProfileConfig,
)
from .pipeline import create_pipeline
from .router import get_category, get_converter, is_supported_format

# Configure logging first
configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("application_starting")
    logger.info("http_server_ready")
    yield
    logger.info("application_stopping")


app = FastAPI(
    title="RAGBase AI Worker",
    description="Document processing worker with format converters",
    version="0.2.0",
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
    return {"ready": True, "mode": "http-dispatch"}


@app.post("/embed", response_model=EmbedResponse)
async def embed_texts(request: EmbedRequest):
    """Generate embeddings for a list of texts."""
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
    Process a document: convert → chunk → quality analyze → embed → callback.

    Uses Strategy Pattern:
    1. Router selects converter based on format
    2. Converter transforms file to Markdown
    3. Pipeline handles chunking + quality + embedding
    """
    logger.info(
        "process_request_received",
        document_id=request.documentId,
        file_path=request.filePath,
        format=request.format,
    )

    start_time = time.time()
    file_format = request.format.lower()

    # Initialize metrics collector
    metrics_collector = MetricsCollector()
    metrics_collector.mark_started()

    try:
        # Validate format
        if not is_supported_format(file_format):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported format: {file_format}",
            )

        # Get converter and category
        converter = get_converter(file_format)
        category = get_category(file_format)

        # Extract profile config from request (if provided)
        profile_config = None
        if request.config and request.config.profileConfig:
            profile_config = request.config.profileConfig
        else:
            profile_config = ProfileConfig()  # Use defaults

        # Get OCR mode for PDF/DOCX
        ocr_mode = profile_config.pdfOcrMode
        if request.config:
            ocr_mode = request.config.ocrMode  # Legacy override

        # 1. Convert to Markdown (with timing)
        metrics_collector.start_stage()
        if file_format in ("pdf", "docx"):
            num_threads = profile_config.pdfNumThreads
            output = await converter.to_markdown(
                request.filePath, ocr_mode, num_threads
            )
        elif file_format in ("txt", "md", "json"):
            output = await converter.to_markdown(request.filePath, file_format)
        else:
            output = await converter.to_markdown(request.filePath)
        metrics_collector.end_conversion()

        # Capture size metrics
        try:
            raw_size = os.path.getsize(request.filePath)
        except OSError:
            raw_size = 0
        markdown_size = len(output.markdown) if output.markdown else 0
        metrics_collector.set_size_metrics(raw_size, markdown_size)

        # Handle conversion errors
        if not output.markdown or not output.markdown.strip():
            error_msg = output.metadata.get("error", "Empty content extracted")
            error_code = (
                "PASSWORD_PROTECTED" if "PASSWORD" in str(error_msg) else "CORRUPT_FILE"
            )
            result = ProcessingResult(
                success=False,
                error_code=error_code,
                error_message=error_msg,
            )
        else:
            # 2. Run pipeline: sanitize → chunk → quality → embed (with timing)
            # Create pipeline with profile config for chunking/quality settings
            pipeline = create_pipeline(profile_config)

            metrics_collector.start_stage()
            chunks, embedding_time_ms = pipeline.run(output.markdown, category)
            metrics_collector.end_chunking()
            metrics_collector.set_embedding_time(embedding_time_ms)

            if not chunks:
                result = ProcessingResult(
                    success=False,
                    error_code="INTERNAL_ERROR",
                    error_message="Failed to chunk content",
                )
            else:
                # Capture chunking and quality metrics
                metrics_collector.set_chunking_metrics(chunks)
                metrics_collector.set_quality_summary(chunks)

                # Calculate page count from metadata
                page_count = (
                    output.page_count
                    or output.slide_count
                    or output.sheet_count
                    or output.chapter_count
                    or 1
                )

                processing_time_ms = int((time.time() - start_time) * 1000)

                # Finalize metrics
                metrics_collector.mark_completed()
                metrics_data = metrics_collector.to_dict()

                result = ProcessingResult(
                    success=True,
                    processed_content=output.markdown,
                    chunks=chunks,
                    page_count=page_count,
                    ocr_applied=output.metadata.get("ocr_applied", False),
                    processing_time_ms=processing_time_ms,
                    format_category=category,
                    metrics=metrics_data,
                )

        # 3. Send callback to backend
        callback_success = await send_callback(request.documentId, result)

        if not callback_success:
            logger.error("callback_failed", document_id=request.documentId)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to send callback for {request.documentId}",
            )

        # 4. Cleanup source file after successful processing
        if result.success:
            try:
                if os.path.exists(request.filePath):
                    os.remove(request.filePath)
                    logger.info("source_file_deleted", file_path=request.filePath)
            except Exception as cleanup_err:
                # Log but don't fail - file cleanup is not critical
                logger.warning(
                    "source_file_cleanup_failed",
                    file_path=request.filePath,
                    error=str(cleanup_err),
                )

        logger.info(
            "process_completed",
            document_id=request.documentId,
            success=result.success,
            format=file_format,
            category=category,
            chunks=len(result.chunks) if result.chunks else 0,
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
        logger.exception("process_error", document_id=request.documentId, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
