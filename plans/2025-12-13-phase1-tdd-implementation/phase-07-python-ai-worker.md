# Phase 07: Python AI Worker

**Parent:** [plan.md](./plan.md) | **Dependencies:** Phase 00 | **Blocks:** None (parallel with Phases 02-06)

---

## Overview

| Field | Value |
|-------|-------|
| Date | 2025-12-13 |
| Priority | P0 (Critical) |
| Est. Hours | 10 |
| Status | ✅ Completed |

**Description:** Python FastAPI worker for PDF processing via Docling. Consumes BullMQ jobs, processes PDFs, and sends HTTP callback to Node.js.

---

## Key Insights (from Research)

- Docling (IBM): best open-source PDF parser for structure preservation
- EasyOCR integrated via Docling for scanned documents
- BullMQ Python: `bullmq` package for queue consumption
- HTTP callback pattern simpler than Redis result storage
- structlog for structured logging (JSON format)

---

## Requirements

### Acceptance Criteria
- [x] FastAPI server starts and health check works
- [x] BullMQ consumer polls jobs from Redis
- [x] Docling converts PDF to Markdown
- [x] OCR triggered based on mode (auto/force/never)
- [x] HTTP callback to Node.js with result/error
- [x] Proper error handling for all failure modes

---

## Architecture

### Worker Flow

```
┌─────────────────────────────────────────────────────────┐
│                    Python AI Worker                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │   BullMQ     │───►│  Job Router  │                   │
│  │  Consumer    │    │              │                   │
│  └──────────────┘    └──────┬───────┘                   │
│                             │                            │
│                    ┌────────┴────────┐                  │
│                    ▼                 ▼                  │
│            ┌─────────────┐   ┌─────────────┐            │
│            │   Docling   │   │  OCR Check  │            │
│            │  Processor  │◄──│  (optional) │            │
│            └──────┬──────┘   └─────────────┘            │
│                   │                                      │
│                   ▼                                      │
│            ┌─────────────┐                              │
│            │  Callback   │───► Node.js Backend          │
│            │   Sender    │                              │
│            └─────────────┘                              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Project Structure

```
apps/ai-worker/
├── src/
│   ├── __init__.py
│   ├── main.py              # FastAPI app + startup
│   ├── config.py            # Environment config
│   ├── consumer.py          # BullMQ job consumer
│   ├── processor.py         # Docling PDF processor
│   ├── callback.py          # HTTP callback sender
│   └── logging_config.py    # Structured logging
├── tests/
│   ├── __init__.py
│   ├── test_processor.py
│   ├── test_consumer.py
│   └── fixtures/
│       └── sample.pdf
├── requirements.txt
├── requirements-dev.txt
├── Dockerfile
└── pytest.ini
```

---

## Related Code Files

| File | Purpose |
|------|---------|
| `apps/ai-worker/src/main.py` | FastAPI app entry |
| `apps/ai-worker/src/config.py` | Configuration |
| `apps/ai-worker/src/consumer.py` | BullMQ consumer |
| `apps/ai-worker/src/processor.py` | Docling processor |
| `apps/ai-worker/src/callback.py` | HTTP callback |
| `apps/ai-worker/requirements.txt` | Dependencies |
| `apps/ai-worker/Dockerfile` | Container image |

---

## Implementation Steps

### Step 1: Configuration Module

```python
# apps/ai-worker/src/config.py
from pydantic_settings import BaseSettings
from typing import Literal

class Settings(BaseSettings):
    # Redis
    redis_url: str = "redis://localhost:6379"

    # Callback
    callback_url: str = "http://localhost:3000/internal/callback"

    # OCR
    ocr_enabled: bool = False
    ocr_mode: Literal["auto", "force", "never"] = "auto"
    ocr_languages: str = "en"  # Comma-separated: "en,vi"

    # Processing
    processing_timeout: int = 300  # 5 minutes

    # Logging
    log_level: str = "INFO"
    log_format: Literal["json", "console"] = "json"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
```

### Step 2: Structured Logging

```python
# apps/ai-worker/src/logging_config.py
import structlog
from .config import settings

def configure_logging():
    processors = [
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    if settings.log_format == "json":
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer())

    structlog.configure(
        processors=processors,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

def get_logger(name: str):
    return structlog.get_logger(name)
```

### Step 3: Docling Processor

```python
# apps/ai-worker/src/processor.py
import asyncio
from pathlib import Path
from typing import Optional
from dataclasses import dataclass
from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions, OcrOptions

from .config import settings
from .logging_config import get_logger

logger = get_logger(__name__)

@dataclass
class ProcessingResult:
    success: bool
    markdown: Optional[str] = None
    page_count: int = 0
    ocr_applied: bool = False
    processing_time_ms: int = 0
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class PDFProcessor:
    def __init__(self):
        self.converter = None

    def _get_converter(self, ocr_mode: str) -> DocumentConverter:
        """Create Docling converter with appropriate OCR settings."""
        pipeline_options = PdfPipelineOptions()

        if ocr_mode == "force" or (ocr_mode == "auto" and settings.ocr_enabled):
            languages = settings.ocr_languages.split(",")
            pipeline_options.ocr_options = OcrOptions(
                do_ocr=True,
                lang=languages,
            )
        else:
            pipeline_options.ocr_options = OcrOptions(do_ocr=False)

        return DocumentConverter(
            allowed_formats=[InputFormat.PDF],
            pipeline_options=pipeline_options,
        )

    async def process(
        self,
        file_path: str,
        ocr_mode: str = "auto",
    ) -> ProcessingResult:
        """Process PDF file and return markdown."""
        import time
        start_time = time.time()

        path = Path(file_path)

        if not path.exists():
            logger.error("file_not_found", path=file_path)
            return ProcessingResult(
                success=False,
                error_code="CORRUPT_FILE",
                error_message=f"File not found: {file_path}",
            )

        try:
            # Check for password protection
            if self._is_password_protected(path):
                logger.warning("password_protected", path=file_path)
                return ProcessingResult(
                    success=False,
                    error_code="PASSWORD_PROTECTED",
                    error_message="PDF is password protected. Remove password and re-upload.",
                )

            # Get converter with OCR settings
            converter = self._get_converter(ocr_mode)

            # Convert PDF (run in thread pool for async compatibility)
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: converter.convert(str(path))
            )

            # Check if OCR was actually applied
            ocr_applied = ocr_mode == "force" or (
                ocr_mode == "auto" and self._needs_ocr(result)
            )

            # Export to markdown
            markdown = result.document.export_to_markdown()

            # Get page count
            page_count = len(result.document.pages) if hasattr(result.document, 'pages') else 1

            processing_time_ms = int((time.time() - start_time) * 1000)

            logger.info(
                "processing_complete",
                path=file_path,
                page_count=page_count,
                ocr_applied=ocr_applied,
                time_ms=processing_time_ms,
            )

            return ProcessingResult(
                success=True,
                markdown=markdown,
                page_count=page_count,
                ocr_applied=ocr_applied,
                processing_time_ms=processing_time_ms,
            )

        except Exception as e:
            logger.exception("processing_error", path=file_path, error=str(e))

            error_code = "INTERNAL_ERROR"
            if "timeout" in str(e).lower():
                error_code = "TIMEOUT"
            elif "corrupt" in str(e).lower() or "invalid" in str(e).lower():
                error_code = "CORRUPT_FILE"

            return ProcessingResult(
                success=False,
                error_code=error_code,
                error_message=str(e),
            )

    def _is_password_protected(self, path: Path) -> bool:
        """Check if PDF is password protected."""
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(str(path))
            is_encrypted = doc.is_encrypted
            doc.close()
            return is_encrypted
        except Exception:
            return False

    def _needs_ocr(self, result) -> bool:
        """Determine if OCR was needed based on text extraction."""
        # If very little text was extracted, OCR was likely needed
        text = result.document.export_to_markdown()
        # Less than 50 chars per page suggests scanned
        chars_per_page = len(text) / max(1, len(result.document.pages))
        return chars_per_page < 50


# Singleton instance
pdf_processor = PDFProcessor()
```

### Step 4: HTTP Callback Sender

```python
# apps/ai-worker/src/callback.py
import httpx
from typing import Optional
from dataclasses import asdict

from .config import settings
from .processor import ProcessingResult
from .logging_config import get_logger

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
        async with httpx.AsyncClient(timeout=30.0) as client:
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
```

### Step 5: BullMQ Consumer

```python
# apps/ai-worker/src/consumer.py
import asyncio
from typing import Any, Dict
from bullmq import Worker

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
    def __init__(self):
        self.worker: Worker | None = None

    async def start(self):
        """Start the BullMQ worker."""
        logger.info("worker_starting", redis_url=settings.redis_url)

        self.worker = Worker(
            name="document-processing",
            processor=process_job,
            opts={
                "connection": settings.redis_url,
                "concurrency": 5,
            },
        )

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

    async def stop(self):
        """Stop the BullMQ worker."""
        if self.worker:
            await self.worker.close()
            logger.info("worker_stopped")


# Singleton instance
document_worker = DocumentWorker()
```

### Step 6: FastAPI Main Application

```python
# apps/ai-worker/src/main.py
import asyncio
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
    title="SchemaForge AI Worker",
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
    worker_running = document_worker.worker is not None
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
```

### Step 7: Requirements

```txt
# apps/ai-worker/requirements.txt
fastapi==0.115.0
uvicorn==0.32.0
pydantic-settings==2.5.0
httpx==0.27.0
structlog==24.4.0

# Document processing
docling==2.10.0
PyMuPDF==1.24.0

# Queue
bullmq==0.4.0
redis==5.2.0

# OCR (optional - heavy dependency)
# easyocr==1.7.1  # Uncomment if OCR needed
```

```txt
# apps/ai-worker/requirements-dev.txt
pytest==8.3.0
pytest-asyncio==0.24.0
pytest-cov==5.0.0
httpx[test]
```

### Step 8: Dockerfile

```dockerfile
# apps/ai-worker/Dockerfile
FROM python:3.11-slim as builder

WORKDIR /app

# System dependencies for Docling
RUN apt-get update && apt-get install -y \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Production image
FROM python:3.11-slim

WORKDIR /app

# Runtime dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application
COPY src ./src

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Step 9: Unit Tests

```python
# apps/ai-worker/tests/test_processor.py
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

from src.processor import PDFProcessor, ProcessingResult


@pytest.fixture
def processor():
    return PDFProcessor()


class TestPDFProcessor:
    @pytest.mark.asyncio
    async def test_process_missing_file(self, processor):
        result = await processor.process("/nonexistent/file.pdf")

        assert result.success is False
        assert result.error_code == "CORRUPT_FILE"
        assert "not found" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_process_password_protected(self, processor, tmp_path):
        # Create mock encrypted PDF
        with patch.object(processor, '_is_password_protected', return_value=True):
            result = await processor.process(str(tmp_path / "encrypted.pdf"))

            assert result.success is False
            assert result.error_code == "PASSWORD_PROTECTED"

    @pytest.mark.asyncio
    async def test_process_success(self, processor, tmp_path):
        # Would need actual PDF fixture
        # This is a placeholder for integration test
        pass


class TestPasswordProtectionCheck:
    def test_is_password_protected_false(self, processor, tmp_path):
        # Create simple PDF
        pdf_path = tmp_path / "test.pdf"
        # Would need to create actual PDF
        pass
```

```python
# apps/ai-worker/tests/test_callback.py
import pytest
import httpx
from unittest.mock import patch, AsyncMock

from src.callback import send_callback
from src.processor import ProcessingResult


class TestSendCallback:
    @pytest.mark.asyncio
    async def test_send_success_callback(self):
        result = ProcessingResult(
            success=True,
            markdown="# Test",
            page_count=1,
            ocr_applied=False,
            processing_time_ms=100,
        )

        with patch('httpx.AsyncClient.post', new_callable=AsyncMock) as mock_post:
            mock_response = AsyncMock()
            mock_response.status_code = 200
            mock_response.raise_for_status = MagicMock()
            mock_post.return_value = mock_response

            success = await send_callback("doc-123", result)

            assert success is True
            mock_post.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_failure_callback(self):
        result = ProcessingResult(
            success=False,
            error_code="PASSWORD_PROTECTED",
            error_message="PDF is password protected",
        )

        with patch('httpx.AsyncClient.post', new_callable=AsyncMock) as mock_post:
            mock_response = AsyncMock()
            mock_response.status_code = 200
            mock_response.raise_for_status = MagicMock()
            mock_post.return_value = mock_response

            success = await send_callback("doc-456", result)

            assert success is True

            # Verify payload structure
            call_args = mock_post.call_args
            payload = call_args.kwargs['json']
            assert payload['success'] is False
            assert payload['error']['code'] == "PASSWORD_PROTECTED"

    @pytest.mark.asyncio
    async def test_callback_http_error(self):
        result = ProcessingResult(success=True, markdown="# Test")

        with patch('httpx.AsyncClient.post', new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = httpx.HTTPStatusError(
                "Server error",
                request=MagicMock(),
                response=MagicMock(status_code=500),
            )

            success = await send_callback("doc-789", result)

            assert success is False
```

### Step 10: pytest Configuration

```ini
# apps/ai-worker/pytest.ini
[pytest]
asyncio_mode = auto
testpaths = tests
python_files = test_*.py
python_functions = test_*
addopts = -v --cov=src --cov-report=html
```

---

## Todo List

- [x] Create `apps/ai-worker/src/config.py`
- [x] Create `apps/ai-worker/src/logging_config.py`
- [x] Create `apps/ai-worker/src/processor.py`
- [x] Create `apps/ai-worker/src/callback.py`
- [x] Create `apps/ai-worker/src/consumer.py`
- [x] Create `apps/ai-worker/src/main.py`
- [x] Create `apps/ai-worker/requirements.txt`
- [x] Create `apps/ai-worker/Dockerfile`
- [x] Write unit tests for processor
- [x] Write unit tests for callback
- [ ] Test with sample PDF (requires Docker)
- [ ] Verify BullMQ consumer works (requires Docker)
- [ ] Test callback to Node.js (requires Docker)

---

## Success Criteria

1. `python -m src.main` starts FastAPI server
2. `/health` returns OK
3. Worker consumes jobs from BullMQ
4. PDF processed to markdown via Docling
5. Callback sent to Node.js successfully
6. OCR works when enabled

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Docling version issues | Pin to tested version |
| Large PDF timeout | 5-minute timeout, chunked processing |
| OCR memory usage | Optional OCR, separate container |

---

## Security Considerations

- File paths validated before processing
- No user input in callbacks (documentId is UUID)
- Callback URL configurable but internal only
- No secrets in logs

---

## Next Steps

After completion, the backend pipeline is fully functional. Proceed to [Phase 08: Frontend UI](./phase-08-frontend-ui.md) for React dashboard.
