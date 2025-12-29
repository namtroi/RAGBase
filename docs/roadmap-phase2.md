# Phase 2: Python-First + Drive Sync + Real-time Updates

**Goal:** Consolidate ML/processing logic in Python, add automated Google Drive ingestion, enable real-time updates, and support all text formats.

**Status:** ✅ COMPLETE (Dec 23, 2025)

---

## Architecture Change: Python-First

### **From Phase 1 (Dual Path):**
- Fast Lane: JSON/TXT/MD → immediate Node.js processing → embed → DB
- Heavy Lane: PDF → queue → Python → callback → Node.js embed → DB
- **Problem:** Dual implementations of embedding/chunking (Node.js + Python)

### **To Phase 2 (Unified Path - IMPLEMENTED):**
- All files → BullMQ queue → Python worker (processing + embedding) → callback → Node.js → DB
- **NEW:** Real-time updates via Server-Sent Events (SSE)
- **NEW:** Multi-format support (PDF, JSON, MD, TXT) in AI Worker
- **Benefit:** Single source of truth, real-time UI updates, simplified codebase

**Rationale:**
- ✅ Eliminate code duplication (embedding/chunking logic)
- ✅ Better maintainability (one implementation)
- ✅ Easier to swap models/algorithms (Python ML ecosystem)
- ✅ Real-time updates without polling
- ✅ Consistent processing for all file types

---

## Formats Supported

- ✅ `.pdf` (digital + scanned with OCR via Docling)
- ✅ `.json` (pretty printed in markdown code block)
- ✅ `.txt` (wrapped with filename heading)
- ✅ `.md` (processed as-is)
- ❌ `.docx` → Deferred to Phase 3

**All formats:** Convert to markdown → Chunk → Embed → Store

---

## Core Features

### **1. Unified Processing Pipeline** ✅

**Implementation:** All file types processed end-to-end in Python

**Steps:**
1. **Convert to markdown:**
   - PDF: Docling with OCR support
   - MD: Read as-is
   - TXT: Wrap with filename heading
   - JSON: Pretty print in code block
2. **Chunk:** LangChain markdown-aware splitting (1000 chars, 200 overlap)
3. **Embed:** sentence-transformers (bge-small-en-v1.5, 384-dim vectors)
4. **Callback:** Send processed content + chunks + embeddings to Node.js backend

**Changes:**
- ✅ Replaced Fastembed (Node.js) with sentence-transformers (Python)
- ✅ Upgraded model: all-MiniLM-L6-v1.5 → bge-small-en-v1.5
- ✅ Removed embedding/chunking logic from Node.js
- ✅ Python worker remains stateless (callback-based)
- ✅ Created `TextProcessor` for non-PDF formats

**Model upgrade benefits:**
- ~10% better retrieval accuracy (MTEB score: 42.0 → 51.7)
- Same 384 dimensions (no pgvector config change)
- Industry-standard library (sentence-transformers)

---

### **2. Real-time Updates via SSE** ✅ NEW

**Purpose:** Replace polling with Server-Sent Events for instant UI updates

**Implementation:**
- Backend: In-memory EventEmitter (`EventBus`)
- Endpoint: `GET /api/events`
- Frontend: `EventProvider` with auto-reconnect

**Events:**
- `document:created` - New upload
- `document:status` - Processing complete/failed
- `sync:start` - Drive sync started
- `sync:complete` - Drive sync finished
- `sync:error` - Drive sync failed

**Benefits:**
- ✅ Instant UI updates (no 3-5s polling delay)
- ✅ Reduced server load (no repeated polling requests)
- ✅ Better UX (real-time feedback)
- ✅ Automatic React Query cache invalidation

**Files:**
- `apps/backend/src/services/event-bus.ts`
- `apps/backend/src/routes/sse-route.ts`
- `apps/frontend/src/hooks/use-sse.ts`
- `apps/frontend/src/providers/EventProvider.tsx`

---

### **3. Multi-format Processing** ✅ NEW

**Problem:** Non-PDF files were marked COMPLETED without processing
- No `processedContent` stored
- No chunks created
- No embeddings generated
- Download failed, search didn't work

**Solution:** Created `TextProcessor` in AI Worker

**Implementation:**
```python
# apps/ai-worker/src/text_processor.py
class TextProcessor:
    async def process(file_path, format):
        content = read_file(file_path)
        markdown = convert_to_markdown(content, format)
        chunks = chunker.chunk(markdown)
        embeddings = embedder.embed([c["content"] for c in chunks])
        return ProcessingResult(...)
```

**Format Handling:**
- `.md` → Return as-is
- `.txt` → Wrap with `# filename` heading
- `.json` → Pretty print in markdown code block

**All formats then:** Chunk → Embed → Callback (same as PDF)

---

### **4. Content Export (Data Validation)** ✅

**Purpose:** Enable users to validate processing quality

**Implementation:**
- Store `processedContent` (markdown) in Document table
- Endpoint: `GET /api/documents/:id/content?format=markdown|json`
- Frontend download buttons (Markdown/JSON)

**Use case:** Quality assurance for critical documents

---

### **5. Google Drive Sync** ✅

**Architecture:** Multi-folder support

**Entities:**
- `DriveConfig`: Stores folder ID, sync schedule, settings
- `Document`: Links to `DriveConfig` via `driveConfigId`

**Sync Strategy:**
- **Initial sync:** Full scan of folder (recursive if enabled)
- **Incremental sync:** Drive Changes API with `pageToken`
- **Deduplication:** MD5 hash check before download
- **Deleted files:** Soft delete (status = `ARCHIVED`)
- **Schedule:** Cron-based (default: every 6 hours, configurable)

**Authorization:**
- Service Account (server-to-server, no user OAuth)
- Scope: `drive.readonly`

**File size limit:** 100MB (larger than 50MB manual upload)

---

## Database Schema Changes

### **Document model additions:**
- `processedContent` (Text): Markdown for download
- `processingMetadata` (JSON): Processing stats
- `sourceType` (String): `MANUAL` or `DRIVE`
- `driveFileId` (String?): Google Drive file ID
- `driveConfigId` (String?): FK to DriveConfig
- `lastSyncedAt` (DateTime?): Last sync timestamp

### **New model: DriveConfig**
- `id`, `folderId` (unique Google Drive folder ID)
- `folderName`: Display name
- `syncCron`: Cron expression (e.g., "0 */6 * * *")
- `recursive`: Boolean (traverse subfolders)
- `enabled`: Boolean (pause/resume sync)
- `lastSyncedAt`: Last successful sync
- Relations: has many Documents

---

## API Changes

### **New Endpoints:**
- `GET /api/events` - SSE real-time updates ✅ NEW
- `GET /api/documents/:id/content?format=markdown|json` - Download processed content ✅
- `POST /api/drive/configs` - Add Drive folder ✅
- `GET /api/drive/configs` - List synced folders ✅
- `PATCH /api/drive/configs/:id` - Update settings ✅
- `DELETE /api/drive/configs/:id` - Remove folder ✅
- `POST /api/drive/sync/:configId/trigger` - Manual sync trigger ✅

### **Modified Endpoints:**
- `POST /internal/callback` - Accept `processedContent` + pre-computed `embeddings` ✅
- `POST /process` - Add `format` field for routing ✅ NEW

---

## Frontend Updates

### **Documents Tab:**
- ✅ Download button (markdown/JSON formats)
- ✅ Source type indicator (manual vs Drive)
- ✅ Filter by Drive folder
- ✅ Real-time status updates (no polling)

### **Drive Sync Tab:**
- ✅ [+ Add Folder] button
- ✅ Folder list with per-folder config
- ✅ Sync frequency dropdown (6h/12h/24h)
- ✅ Recursive toggle
- ✅ Last synced timestamp
- ✅ Actions: [Edit] [Delete] [Sync Now]
- ✅ Real-time sync status updates

---

## Configuration

### **Environment Variables:**

**Drive Sync:**
```bash
DRIVE_SERVICE_ACCOUNT_KEY=/path/to/service-account.json
DRIVE_SYNC_CRON=0 */6 * * *
DRIVE_MAX_FILE_SIZE_MB=100
DRIVE_RECURSIVE=true
```

**Processing (moved to Python):**
```bash
EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
EMBEDDING_DIMENSION=384
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
```

**Python Dependencies:**
```
sentence-transformers>=2.3.0
torch>=2.0.0  # CPU version
langchain>=0.3.0
langchain-text-splitters>=0.3.0
docling>=2.15.0
```

---

## Migration Path

**Implemented steps:**

1. ✅ Installed sentence-transformers in Python worker
2. ✅ Implemented embedding with bge-small-en-v1.5
3. ⏭️ Re-embed Phase 1 data (SKIPPED - reset data instead)
4. ✅ Updated callback handler (accept pre-computed embeddings)
5. ✅ Removed Node.js embedding code (deleted Fastembed)
6. ✅ Killed Fast Lane (route all files through queue)
7. ✅ Added Drive sync (backend API + cron + frontend UI)
8. ✅ Implemented SSE real-time updates
9. ✅ Added multi-format processing support

---

## Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| **Remove Fast Lane** | Simplify architecture; 1-2s latency acceptable | ✅ Done |
| **Python-only embedding** | Single source of truth, easier maintenance | ✅ Done |
| **Multi-folder support** | Users may have multiple Drive folders | ✅ Done |
| **Incremental sync** | Efficient (only fetch changes) | ✅ Done |
| **Service Account auth** | Server-to-server, no user interaction | ✅ Done |
| **Soft delete** | Preserve history when Drive files removed | ✅ Done |
| **Content export** | Enable manual quality validation | ✅ Done |
| **SSE for real-time** | Better UX than polling | ✅ Done |
| **TextProcessor** | Consistent processing for all formats | ✅ Done |

---

## Trade-offs

| Aspect | Phase 1 | Phase 2 | Impact |
|--------|---------|---------|--------|
| **Text file latency** | ~100ms (sync) | ~1-2s (queued) | ✅ Acceptable |
| **Code complexity** | High (2 paths) | Medium (1 path) | ✅ -30% maintenance |
| **Embedding consistency** | Risky (duplicate) | Safe (single impl) | ✅ Easier to debug |
| **ML flexibility** | Limited (Node.js) | High (Python) | ✅ Future-proof |
| **UI updates** | Polling (3-5s) | SSE (instant) | ✅ Better UX |
| **Format support** | PDF only in queue | All formats | ✅ Consistent |

---

## Success Criteria

**Phase 2 complete when:**
- ✅ All embedding/chunking logic consolidated in Python
- ✅ Fast Lane removed (all files via queue)
- ✅ Drive sync functional (cron + manual trigger)
- ✅ Content export endpoint working (markdown + JSON)
- ✅ Multi-folder support implemented
- ✅ SSE real-time updates working
- ✅ All formats (PDF/JSON/MD/TXT) processed correctly
- ✅ Zero regression in accuracy vs Phase 1
- ✅ Tests passing (232 backend tests + AI worker tests)

---

**Phase 2 Status: ✅ COMPLETE (Dec 23, 2025)**

**Total Implementation Time:** ~26 hours
- Core features (2A-2F): ~20h
- SSE real-time updates: ~4h
- Multi-format processing: ~2h
