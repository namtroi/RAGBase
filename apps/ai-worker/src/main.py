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
    ProcessingResult,
)
from .processor import pdf_processor
from .text_processor import text_processor
from .csv_processor import CsvProcessor
from .html_processor import HtmlProcessor
from .epub_processor import EpubProcessor
from .xlsx_processor import XlsxProcessor
from .pptx_processor import PptxProcessor
from .chunkers.document_chunker import DocumentChunker
from .chunkers.presentation_chunker import PresentationChunker
from .chunkers.tabular_chunker import TabularChunker
from .quality.analyzer import QualityAnalyzer
from .embedder import Embedder

# Initialize Phase 4 processors (singletons)
csv_processor = CsvProcessor()
html_processor = HtmlProcessor()
epub_processor = EpubProcessor()
xlsx_processor = XlsxProcessor()
pptx_processor = PptxProcessor()

# Format category mapping
FORMAT_CATEGORIES = {
    "pdf": "document",
    "docx": "document",
    "txt": "document",
    "md": "document",
    "html": "document",
    "epub": "document",
    "pptx": "presentation",
    "xlsx": "tabular",
    "csv": "tabular",
    "json": "tabular",
}

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
    Process a document dispatched from the backend.

    Routes to appropriate processor based on format, applies chunking,
    quality analysis, and embedding. Sends callback with results.
    """
    logger.info(
        "process_request_received",
        document_id=request.documentId,
        file_path=request.filePath,
        format=request.format,
    )

    try:

        # Get OCR mode from config
        ocr_mode = "auto"
        if request.config:
            ocr_mode = request.config.ocrMode

        # Route to appropriate processor based on format
        file_format = request.format.lower()
        format_category = FORMAT_CATEGORIES.get(file_format, "document")

        # Process based on format
        if file_format in ("pdf", "docx"):
            # PDF/DOCX uses Docling - already returns ProcessingResult
            result = await pdf_processor.process(request.filePath, ocr_mode)

        elif file_format in ("md", "txt", "json"):
            # Text files - already returns ProcessingResult
            result = await text_processor.process(request.filePath, file_format)

        else:
            # Phase 4 formats - need to process then chunk/embed
            result = await _process_new_format(
                file_format, request.filePath, format_category
            )

        # Inject format category into result for callback
        if result.success:
            result.format_category = format_category

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
            format=file_format,
            category=format_category,
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


async def _process_new_format(
    file_format: str, file_path: str, format_category: str
) -> "ProcessingResult":
    """
    Process Phase 4 formats (csv, html, xlsx, epub, pptx).

    These processors return ProcessorOutput (markdown only), so we need to:
    1. Get markdown from processor
    2. Apply category-based chunking
    3. Analyze quality
    4. Generate embeddings
    5. Return ProcessingResult
    """
    import time

    start_time = time.time()

    # 1. Route to format processor
    processor_map = {
        "csv": csv_processor,
        "html": html_processor,
        "xlsx": xlsx_processor,
        "epub": epub_processor,
        "pptx": pptx_processor,
    }

    processor = processor_map.get(file_format)
    if not processor:
        return ProcessingResult(
            success=False,
            error_code="UNSUPPORTED_FORMAT",
            error_message=f"Unsupported format: {file_format}",
        )

    # 2. Get markdown from processor
    output = await processor.process(file_path)

    if not output.markdown or not output.markdown.strip():
        error_msg = output.metadata.get("error", "Empty content extracted")
        return ProcessingResult(
            success=False,
            error_code="CORRUPT_FILE",
            error_message=error_msg,
        )

    # 3. Select chunker based on category
    if format_category == "presentation":
        chunker = PresentationChunker()
    elif format_category == "tabular":
        chunker = TabularChunker()
    else:
        chunker = DocumentChunker()

    chunks = chunker.chunk(output.markdown)

    if not chunks:
        return ProcessingResult(
            success=False,
            error_code="INTERNAL_ERROR",
            error_message="Failed to chunk content",
        )

    # 4. Analyze quality for each chunk
    analyzer = QualityAnalyzer()
    for chunk in chunks:
        quality = analyzer.analyze(chunk)
        chunk["metadata"]["qualityScore"] = quality["score"]
        chunk["metadata"]["qualityFlags"] = [f.value for f in quality["flags"]]
        chunk["metadata"]["hasTitle"] = quality["has_title"]
        chunk["metadata"]["completeness"] = quality["completeness"]
        chunk["metadata"]["chunkType"] = format_category

    # 5. Generate embeddings
    embedder = Embedder()
    texts = [c["content"] for c in chunks]
    embeddings = embedder.embed(texts)

    for i, chunk in enumerate(chunks):
        chunk["embedding"] = embeddings[i]
        chunk["index"] = i

    # 6. Calculate page/slide/sheet count
    page_count = 1
    if output.page_count:
        page_count = output.page_count
    elif output.slide_count:
        page_count = output.slide_count
    elif output.sheet_count:
        page_count = output.sheet_count
    elif output.chapter_count:
        page_count = output.chapter_count

    processing_time_ms = int((time.time() - start_time) * 1000)

    logger.info(
        "new_format_processing_complete",
        format=file_format,
        category=format_category,
        chunks=len(chunks),
        time_ms=processing_time_ms,
    )

    return ProcessingResult(
        success=True,
        processed_content=output.markdown,
        chunks=chunks,
        page_count=page_count,
        ocr_applied=False,
        processing_time_ms=processing_time_ms,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
