# Phase 07: Python AI Worker

**Parent:** [plan.md](./plan.md) | **Status:** Complete | **Priority:** P0

## Objectives
Build a Python worker for heavy processing (PDFs) using Docling for high-quality extraction.

## Acceptance Criteria
- [x] AI Worker connects to Redis; consumes BullMQ jobs via `consumer.py`.
- [x] Docling integration for PDF -> Markdown conversion in `processor.py`.
- [x] Success/Fail callback to Backend via `callback.py`.
- [x] Fully dockerized with Python 3.11+ (multi-stage Dockerfile).

## Key Files
- `apps/ai-worker/src/main.py`: FastAPI entry point with health/ready endpoints.
- `apps/ai-worker/src/processor.py`: Docling PDF→Markdown, OCR detection, password-protected handling.
- `apps/ai-worker/src/callback.py`: HTTP POST webhook to Node.js backend.
- `apps/ai-worker/src/consumer.py`: BullMQ DocumentWorker with job processing logic.
- `apps/ai-worker/src/config.py`: Pydantic-settings for env vars (Redis, OCR, logging).
- `apps/ai-worker/src/logging_config.py`: Structlog setup with JSON/console output.
- `apps/ai-worker/Dockerfile`: Multi-stage build with Python 3.11-slim.
- `apps/ai-worker/requirements.txt`: Core deps + optional heavy deps (docling, easyocr).
- `apps/ai-worker/tests/`: Comprehensive pytest tests for all modules.

## Implementation Steps (Completed)
1. ~~Setup Python environment~~ → pip with requirements.txt, pydantic-settings.
2. ~~Configure Redis consumer~~ → BullMQ Worker in `consumer.py`.
3. ~~Implement PDF processing~~ → `processor.py` with Docling, OCR, PyMuPDF.
4. ~~Build HTTP POST mechanism~~ → `callback.py` with httpx async client.

## Verification
- Health check: `GET /health` returns service status.
- Readiness: `GET /ready` verifies worker is running.
- Tests: `pytest apps/ai-worker/tests/` covers processor, consumer, callback.
- Error handling: Password-protected, corrupt, timeout scenarios covered.

## Notes
- Heavy deps (docling, bullmq, easyocr) listed as optional to avoid large CI builds.
- OCR configurable via env: `OCR_ENABLED`, `OCR_MODE`, `OCR_LANGUAGES`.
