# Phase 07: Python AI Worker

**Parent:** [plan.md](./plan.md) | **Status:** Pending | **Priority:** P0

## Objectives
Build a Python worker for heavy processing (PDFs) using Docling for high-quality extraction.

## Acceptance Criteria
- [ ] AI Worker connects to Redis; consumes BullMQ jobs.
- [ ] Docling integration for PDF -> Markdown conversion.
- [ ] Success/Fail callback to Backend.
- [ ] Fully dockerized with Python 3.11+.

## Key Files
- `ai-worker/src/main.py`: Entry point.
- `ai-worker/src/processor.py`: Docling extraction logic.
- `ai-worker/src/callback.py`: Webhook calling logic.

## Implementation Steps
1. Setup Python environment (Poetry/Pip).
2. Configure Redis consumer.
3. Implement PDF processing via Docling.
4. Build HTTP POST mechanism for status reporting.

## Verification
- Run worker locally; check logs for jobs.
- Debug error scenarios (password-protected, corrupt) for handling check.
