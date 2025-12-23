# Phase 2: Python-First + Drive Sync

**Goal:** Consolidate ML/processing logic in Python, add automated Google Drive ingestion, enable data quality validation.

---

## Architecture Change: Python-First

### **From Phase 1 (Dual Path):**
- Fast Lane: JSON/TXT/MD → immediate Node.js processing → embed → DB
- Heavy Lane: PDF → queue → Python → callback → Node.js embed → DB
- **Problem:** Dual implementations of embedding/chunking (Node.js + Python)

### **To Phase 2 (Unified Path):**
- All files → BullMQ queue → Python worker (processing + embedding) → callback → Node.js → DB
- **Benefit:** Single source of truth, simplify codebase, leverage Python ML ecosystem

**Rationale:**
- Eliminate code duplication (embedding/chunking logic)
- Better maintainability (one implementation)
- Easier to swap models/algorithms (Python has richer ML libraries)
- Accept 1-2s latency for text files (async processing is acceptable per requirements)

---

## Formats Supported

- ✅ `.pdf` (digital + scanned with OCR)
- ✅ `.json`, `.txt`, `.md` (via queue, no more Fast Lane)
- ❌ `.docx` → Deferred to Phase 3

---

## Core Features

### **1. Unified Processing Pipeline**

**Concept:** Python AI worker handles ALL file types end-to-end

**Steps:**
1. **Convert to markdown:** Use Docling for PDF, direct read for text formats
2. **Chunk:** LangChain with markdown-aware splitting (1000 chars, 200 overlap)
3. **Embed:** sentence-transformers (bge-small-en-v1.5, 384-dim vectors)
4. **Callback:** Send processed content + chunks + embeddings to Node.js backend

**Changes:**
- Replace Fastembed (Node.js) with sentence-transformers (Python)
- Upgrade model: all-MiniLM-L6-v2 → bge-small-en-v1.5 (better retrieval quality)
- Remove embedding/chunking logic from Node.js
- Python worker becomes stateless (no DB writes, callback-based)

**Model upgrade benefits:**
- ~10% better retrieval accuracy (MTEB score: 42.0 → 51.7)
- Same 384 dimensions (no pgvector config change)
- Industry-standard library (sentence-transformers)

---

### **2. Content Export (Data Validation)**

**Purpose:** Enable users to validate processing quality before committing to vector DB

**Implementation:**
- Store `processedContent` (markdown) in Document table
- New endpoint: `GET /api/documents/:id/content?format=markdown|json`
- User workflow: Upload → Process → Download → Review → Keep/Delete

**Use case:** Quality assurance for critical documents

---

### **3. Google Drive Sync**

**Architecture: Multi-folder support**

**Entities:**
- `DriveConfig`: Stores folder ID, sync schedule, settings per folder
- `Document`: Links to `DriveConfig` via `driveConfigId`

**Sync Strategy:**
- **Initial sync:** Full scan of folder (recursive if enabled)
- **Incremental sync:** Use Drive Changes API with `pageToken`
- **Deduplication:** MD5 hash check before download
- **Deleted files:** Soft delete (status = `ARCHIVED`)
- **Schedule:** Cron-based (default: every 6 hours, configurable per folder)

**Authorization:**
- Service Account (server-to-server, no user OAuth)
- Scope: `drive.readonly`

**File size limit:** 100MB (larger than 50MB manual upload)

---

## Database Schema Changes

### **Document model additions:**
- `processedContent` (Text): Markdown for download
- `processingMetadata` (JSON): Stats about processing
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

**Indexing:**
- `driveFileId` (unique)
- `driveConfigId` (for filtering documents by folder)

---

## API Changes

### **New Endpoints:**
- `GET /api/documents/:id/content?format=markdown|json` - Download processed content
- `POST /api/drive/configs` - Add Drive folder
- `GET /api/drive/configs` - List synced folders
- `POST /api/drive/sync/:configId/trigger` - Manual sync trigger

### **Modified Endpoints:**
- `POST /internal/callback` - Accept `processedContent` + pre-computed `embeddings`

**Callback payload changes:**
- Add `processedContent` field (markdown string)
- Chunks now include `embedding` field (computed in Python)

---

## Frontend Updates

### **Documents Tab:**
- Download button (markdown/JSON formats)
- Source type indicator (manual vs Drive)
- Filter by Drive folder

### **New: Drive Sync Tab**

**Components:**
- **[+ Add Folder]** button → Opens Google Drive Picker
- **Folder list** with per-folder config:
  - Folder name (from Drive metadata)
  - Sync frequency dropdown (6h/12h/24h)
  - Recursive toggle
  - Last synced timestamp
  - Actions: [Edit] [Delete] [Sync Now]
- **Sync history** panel (logs per folder)

---

## Configuration

### **Environment Variables:**

**Drive Sync:**
- `DRIVE_SERVICE_ACCOUNT_KEY`: Path to JSON key file
- `DRIVE_SYNC_CRON`: Default cron expression (overridable per folder)
- `DRIVE_MAX_FILE_SIZE_MB`: 100MB default
- `DRIVE_RECURSIVE`: Default true

**Processing (moved to Python):**
- `EMBEDDING_MODEL`: BAAI/bge-small-en-v1.5
- `EMBEDDING_DIMENSION`: 384
- `CHUNK_SIZE`: 1000
- `CHUNK_OVERLAP`: 200

**Python Dependencies:**
- `sentence-transformers>=2.3.0`
- `torch>=2.0.0` (CPU)
- `langchain>=1.0.0`
- `docling>=2.15.0`

---

## Migration Path

**Sequential steps (minimize risk):**

1. **Install sentence-transformers** in Python worker
2. **Implement embedding with bge-small-en-v1.5**
3. **Re-embed Phase 1 data** (all existing documents/chunks)
   - Run migration script to regenerate all embeddings
   - Keep old embeddings as backup
   - Verify retrieval quality before deleting old embeddings
4. **Update callback handler** (accept pre-computed embeddings)
5. **Remove Node.js embedding code** (delete Fastembed dependency)
6. **Kill Fast Lane** (route all files through queue)
7. **Add Drive sync** (backend API + cron job + frontend UI)

**Critical:** Step 3 (re-embedding) is mandatory because model changed. Budget ~1-2 hours for 10K documents.

**Testing at each step:** Ensure no regression in accuracy or latency before proceeding.

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| **Remove Fast Lane** | Simplify architecture; 1-2s latency acceptable for text files |
| **Python-only embedding** | Single source of truth, easier maintenance |
| **Multi-folder support** | Users may have multiple Drive folders to sync |
| **Incremental sync** | Efficient (only fetch changes vs full scan) |
| **Service Account auth** | Server-to-server, no user interaction needed |
| **Soft delete** | Preserve history when Drive files are removed |
| **Content export** | Enable manual quality validation |
| **100MB file limit** | Prevent abuse, reasonable for documents |

---

## Trade-offs

| Aspect | Phase 1 | Phase 2 | Impact |
|--------|---------|---------|--------|
| **Text file latency** | ~100ms (synchronous) | ~1-2s (queued) | Acceptable (not user-facing) |
| **Code complexity** | High (2 processing paths) | Medium (1 path) | -30% maintenance burden |
| **Embedding consistency** | Risky (duplicate logic) | Safe (single implementation) | Easier to debug |
| **ML flexibility** | Limited (Node.js ecosystem) | High (Python ecosystem) | Future-proof for model upgrades |

---

## Success Criteria

**Phase 2 complete when:**
- ✅ All embedding/chunking logic consolidated in Python
- ✅ Fast Lane removed (all files via queue)
- ✅ Drive sync functional (cron + manual trigger)
- ✅ Content export endpoint working (markdown + JSON)
- ✅ Multi-folder support implemented
- ✅ Zero regression in accuracy vs Phase 1
- ✅ Tests passing (unit + integration + E2E)
