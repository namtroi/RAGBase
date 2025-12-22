# Phase 07: Python AI Worker

**Parent:** [plan.md](./plan.md) | **Status:** ✅ **DONE** | **Priority:** P0

## Objectives
Build production-ready Python FastAPI worker for PDF processing using Docling, with HTTP dispatch pattern, comprehensive error handling, structured logging, and full test coverage.

## Acceptance Criteria
- [x] 628 lines of source code across 7 modules
- [x] 713 lines of pytest tests (4 test files)
- [x] FastAPI with HTTP dispatch pattern (/process endpoint)
- [x] Docling integration for PDF → Markdown conversion
- [x] OCR support (auto/force/never modes)
- [x] HTTP callback to backend (success/failure)
- [x] Structured logging (structlog with JSON output)
- [x] Multi-stage Docker build (Python 3.11-slim)
- [x] Health/ready endpoints
- [x] Comprehensive error handling (password-protected, corrupt, timeout)

## Key Files & Components

### Source Code (628 total lines)
- `apps/ai-worker/src/main.py`: 158 lines (FastAPI app, /process endpoint, health/ready)
- `apps/ai-worker/src/processor.py`: 189 lines (Docling PDF processing, OCR detection)
- `apps/ai-worker/src/callback.py`: 61 lines (HTTP POST to backend)
- `apps/ai-worker/src/consumer.py`: 117 lines (BullMQ consumer - deprecated)
- `apps/ai-worker/src/config.py`: 28 lines (Pydantic settings)
- `apps/ai-worker/src/logging_config.py`: 42 lines (Structlog setup)

### Tests (713 total lines)
- `apps/ai-worker/tests/test_main.py`: FastAPI endpoint tests
- `apps/ai-worker/tests/test_processor.py`: PDF processing tests
- `apps/ai-worker/tests/test_callback.py`: Callback mechanism tests
- `apps/ai-worker/tests/test_consumer.py`: Consumer tests (deprecated)

### Infrastructure
- `apps/ai-worker/Dockerfile`: Multi-stage build (build + runtime)
- `apps/ai-worker/requirements.txt`: Core + optional deps
- `apps/ai-worker/pytest.ini`: Pytest config with coverage

## Implementation Details

### 1. FastAPI Application (main.py - 158 lines)
- `POST /process`: HTTP dispatch endpoint (replaces queue consumer)
- `GET /health`, `GET /ready`: Health/readiness checks
- **Flow:** Receive HTTP → Process PDF → Send callback → Return 200
- **Why HTTP:** Avoids race conditions from dual queue consumers

### 2. PDF Processor (processor.py - 189 lines)
- Docling integration (high-quality PDF → Markdown)
- OCR modes: auto (if needed), force (always), never (skip)
- Error detection: PASSWORD_PROTECTED, CORRUPT_FILE, TIMEOUT
- Tracking: processing time, page count, OCR applied

### 3. Callback Mechanism (callback.py - 61 lines)
- HTTP POST to `/internal/callback`
- Success: markdown, pageCount, ocrApplied, processingTimeMs
- Failure: error code + message
- Async httpx, 3 retry attempts, timeout handling

### 4. Configuration (config.py - 28 lines)
- Pydantic settings: REDIS_URL, BACKEND_URL, OCR config, LOG_LEVEL

### 5. Structured Logging (logging_config.py - 42 lines)
- Structlog: JSON (production), console (development)
- Context: request ID, document ID, processing time

### 6. Docker Build (Dockerfile)
- Multi-stage: build (Python 3.11 + tools) + runtime (3.11-slim)
- Dependencies: core (FastAPI, httpx) + optional (Docling, EasyOCR)

## Verification

```bash
cd apps/ai-worker && pytest  # All tests with coverage
uvicorn src.main:app --reload  # Start worker
curl http://localhost:8000/health  # Health check
curl -X POST http://localhost:8000/process -H "Content-Type: application/json" \
  -d '{"documentId": "uuid", "filePath": "/path/to/file.pdf", "config": {"ocrMode": "auto"}}'
```

## Critical Notes

### HTTP Dispatch Pattern
- Backend HTTP dispatches to AI worker (not dual queue consumers)
- Avoids race conditions, simpler error handling
- Trade-off: AI worker must be running

### Docling Integration
- High-quality PDF → Markdown (preserves structure)
- OCR support for scanned PDFs
- Page count extraction

### Error Handling
- Permanent: PASSWORD_PROTECTED, CORRUPT_FILE (no retry)
- Temporary: TIMEOUT, INTERNAL_ERROR (retry possible)
- Callback always sent (success or failure)

### OCR Strategy
- Auto: OCR if text extraction fails (smart default)
- Force: Always OCR (scanned documents)
- Never: Skip OCR (digital PDFs)

### Logging
- Structlog: JSON (production), console (development)
- Context: request ID, document ID, processing time

### Test Coverage
- 713 lines: Comprehensive pytest suite
- Async support, fixtures, mocking (httpx, Docling)
- Coverage: HTML + terminal reports

### Performance
- Async: FastAPI + httpx (non-blocking)
- Multi-stage Docker (smaller image)
- Layer caching for dependencies

### Deprecated
- consumer.py: BullMQ consumer (replaced by HTTP dispatch)
- Why: Race condition issues with dual consumers
- Kept for reference
