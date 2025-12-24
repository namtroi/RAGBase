# Phase 2 Detailed Implementation Plan

**Python-First + Drive Sync + Real-time Updates** | **TDD Approach**

---

## Overview

| Part | Name | Description | Status |
|------|------|-------------|--------|
| **2A** | Python Embedding & Chunking | AI Worker generates embeddings + chunks | ✅ Complete |
| **2B** | Backend Callback Update | Accept embeddings from Python | ✅ Complete |
| **2C** | Kill Fast Lane | Route all files through queue | ✅ Complete |
| **2D** | Content Export | Download processed markdown/JSON | ✅ Complete |
| **2E** | Drive Sync - Backend | DriveConfig model, sync API, cron | ✅ Complete |
| **2F** | Drive Sync - Frontend | UI for Drive folder management | ✅ Complete |
| **2G** | Re-embed Migration | Migrate Phase 1 data to new model | ⏭️ Skipped |
| **2H** | SSE Real-time Updates | Replace polling with Server-Sent Events | ✅ Complete |
| **2I** | Multi-format Processing | Support JSON/MD/TXT in AI Worker | ✅ Complete |

---

## Part 2A: Python Embedding & Chunking ✅

**Status:** Complete  
**Implementation:** `apps/ai-worker/src/embedder.py`, `apps/ai-worker/src/chunker.py`

### Key Changes:
- ✅ Installed `sentence-transformers>=2.3.0`, `langchain>=0.3.0`
- ✅ Created `Embedder` class using `BAAI/bge-small-en-v1.5` (384d)
- ✅ Created `Chunker` class with markdown-aware splitting (1000 chars, 200 overlap)
- ✅ Updated `PDFProcessor` to chunk → embed → callback
- ✅ All tests passing

---

## Part 2B: Backend Callback Update ✅

**Status:** Complete  
**Implementation:** `apps/backend/src/routes/internal/callback-route.ts`

### Key Changes:
- ✅ Updated callback schema to accept `processedContent` + `chunks[].embedding`
- ✅ Removed Fastembed embedding logic from backend
- ✅ Store pre-computed embeddings directly from Python
- ✅ Added `processedContent` field to Document model
- ✅ Increased `bodyLimit` to 100MB for large PDF callbacks

---

## Part 2C: Kill Fast Lane ✅

**Status:** Complete  
**Implementation:** `apps/backend/src/queue/job-processor.ts`

### Key Changes:
- ✅ Removed fast lane logic entirely
- ✅ All files (PDF, JSON, TXT, MD) now go through BullMQ queue
- ✅ Removed Fastembed dependency from `package.json`
- ✅ All documents use `lane: 'heavy'`

---

## Part 2D: Content Export ✅

**Status:** Complete  
**Implementation:** `apps/backend/src/routes/documents/content-route.ts`

### Endpoint:
```
GET /api/documents/:id/content?format=markdown|json
```

### Features:
- ✅ Returns 404 for non-existent documents
- ✅ Returns 409 for non-completed documents
- ✅ Markdown format: raw text with proper headers
- ✅ JSON format: includes chunks with metadata
- ✅ Frontend download buttons working

---

## Part 2E: Drive Sync - Backend ✅

**Status:** Complete  
**Implementation:**
- `apps/backend/src/services/drive-service.ts`
- `apps/backend/src/services/sync-service.ts`
- `apps/backend/src/routes/drive/*`

### Features:
- ✅ DriveConfig model with folder management
- ✅ Google Drive API integration (Service Account)
- ✅ Incremental sync with Changes API + pageToken
- ✅ MD5 deduplication
- ✅ Cron-based auto-sync (configurable per folder)
- ✅ Manual sync trigger endpoint
- ✅ Soft delete for removed files (status: ARCHIVED)

### Endpoints:
```
POST   /api/drive/configs           - Add folder
GET    /api/drive/configs           - List folders
PATCH  /api/drive/configs/:id       - Update settings
DELETE /api/drive/configs/:id       - Remove folder
POST   /api/drive/sync/:configId/trigger - Manual sync
```

---

## Part 2F: Drive Sync - Frontend ✅

**Status:** Complete  
**Implementation:** `apps/frontend/src/components/drive/*`

### Components:
- ✅ `DriveSyncTab.tsx` - Main tab with folder list
- ✅ `DriveConfigList.tsx` - Folder cards with status
- ✅ `AddFolderModal.tsx` - Add new folder dialog
- ✅ Document list filter by Drive folder
- ✅ Download buttons (Markdown/JSON)
- ✅ Source type indicators

---

## Part 2G: Re-embed Migration ⏭️

**Status:** Skipped  
**Reason:** User opted to reset development data instead of migrating Phase 1 embeddings.

---

## Part 2H: SSE Real-time Updates ✅

**Status:** Complete (NEW in Phase 2)  
**Implementation:**
- Backend: `apps/backend/src/services/event-bus.ts`, `apps/backend/src/routes/sse-route.ts`
- Frontend: `apps/frontend/src/hooks/use-sse.ts`, `apps/frontend/src/providers/EventProvider.tsx`

### Architecture:
```
Backend EventBus (EventEmitter) → SSE Endpoint → Frontend EventProvider → React Query Invalidation
```

### Events:
- `document:created` - New document uploaded
- `document:status` - Processing status changed (COMPLETED/FAILED)
- `sync:start` - Drive sync started
- `sync:complete` - Drive sync completed
- `sync:error` - Drive sync failed

### Key Features:
- ✅ Native Fastify SSE with EventSource API
- ✅ Auto-reconnect with exponential backoff
- ✅ API key authentication via query parameter (EventSource limitation)
- ✅ Heartbeat every 30s to keep connection alive
- ✅ React Query cache invalidation on events
- ✅ Removed polling from `use-documents.ts` and `DriveSyncTab.tsx`

### Files:
- `apps/backend/src/services/event-bus.ts` - In-memory pub/sub
- `apps/backend/src/routes/sse-route.ts` - SSE endpoint
- `apps/backend/src/routes/internal/callback-route.ts` - Emit document events
- `apps/backend/src/routes/documents/upload-route.ts` - Emit document:created
- `apps/backend/src/services/sync-service.ts` - Emit sync events
- `apps/frontend/src/hooks/use-sse.ts` - SSE connection hook
- `apps/frontend/src/contexts/EventContext.ts` - React context
- `apps/frontend/src/hooks/use-events.ts` - Context consumer hook
- `apps/frontend/src/providers/EventProvider.tsx` - Global SSE provider
- `apps/frontend/src/App.tsx` - Wrapped with EventProvider

### Tests:
- ✅ `apps/backend/tests/unit/services/event-bus.test.ts`
- ✅ `apps/backend/tests/integration/routes/sse-route.test.ts`
- ✅ All 232 backend tests passing

---

## Part 2I: Multi-format Processing ✅

**Status:** Complete (NEW in Phase 2)  
**Implementation:** `apps/ai-worker/src/text_processor.py`

### Problem Solved:
Non-PDF files (JSON, MD, TXT) were marked COMPLETED without processing:
- ❌ No `processedContent` stored
- ❌ No chunks created
- ❌ No embeddings generated
- ❌ Download failed
- ❌ Search didn't work

### Solution:
Created `TextProcessor` to handle all non-PDF formats:

```python
# apps/ai-worker/src/text_processor.py
class TextProcessor:
    async def process(file_path, format):
        # 1. Read file content
        # 2. Convert to markdown based on format:
        #    - MD: return as-is
        #    - TXT: wrap with filename heading
        #    - JSON: pretty print in code block
        # 3. Chunk with same logic as PDF
        # 4. Embed with same model (bge-small-en-v1.5)
        # 5. Return ProcessingResult
```

### Updated Files:
- `apps/ai-worker/src/text_processor.py` - NEW
- `apps/ai-worker/src/main.py` - Route by format (PDF→Docling, others→TextProcessor)
- `apps/backend/src/queue/job-processor.ts` - Dispatch ALL formats to AI worker

### Flow:
```
Upload (any format) → Queue → Job Processor
    → Dispatch to AI Worker with format field
        → AI Worker routes:
            - PDF → PDFProcessor (Docling)
            - MD/TXT/JSON → TextProcessor
        → Chunk → Embed → Callback
    → Backend saves processedContent + chunks
```

### Tests:
- ✅ TextProcessor imports successfully
- ✅ All backend tests passing
- ✅ Manual E2E test: MD file uploaded → processed → downloaded → searched

---

## Progress Tracking

| Part | Status | Completed |
|------|--------|-----------|
| 2A | ✅ Complete | Dec 2024 |
| 2B | ✅ Complete | Dec 2024 |
| 2C | ✅ Complete | Dec 2024 |
| 2D | ✅ Complete | Dec 2024 |
| 2E | ✅ Complete | Dec 2024 |
| 2F | ✅ Complete | Dec 2024 |
| 2G | ⏭️ Skipped | N/A |
| 2H | ✅ Complete | Dec 23, 2024 |
| 2I | ✅ Complete | Dec 23, 2024 |

---

## Test Commands

```bash
# AI Worker
cd apps/ai-worker && pytest tests/ -v

# Backend (232 tests)
cd apps/backend && pnpm test

# Frontend
cd apps/frontend && pnpm build

# Full suite
pnpm test
```

---

## Actual Timeline

| Part | Estimated | Actual | Notes |
|------|-----------|--------|-------|
| 2A-2F | ~16h | ~20h | Initial Phase 2 implementation |
| 2H (SSE) | N/A | ~4h | Real-time updates (unplanned) |
| 2I (Multi-format) | N/A | ~2h | Fix non-PDF processing (unplanned) |
| **Total** | ~16h | ~26h | +10h for real-time features |

---

## Key Learnings

1. **SSE Auth**: EventSource doesn't support custom headers → Use query param for API key
2. **Fast Refresh**: React requires separating contexts/hooks/components into different files
3. **Multi-format**: Always process ALL formats through AI worker for consistency
4. **Polling Removal**: SSE eliminates need for `refetchInterval` in React Query
5. **DELETE Requests**: Don't set `Content-Type: application/json` when body is empty

---

**Phase 2 Status: ✅ COMPLETE**
