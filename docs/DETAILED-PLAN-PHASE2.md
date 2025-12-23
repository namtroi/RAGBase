# Phase 2 Detailed Implementation Plan

**Python-First + Drive Sync** | **TDD Approach**

---

## Overview

| Part | Name | Description | Dependencies |
|------|------|-------------|--------------|
| **2A** | Python Embedding & Chunking | AI Worker generates embeddings + chunks | None |
| **2B** | Backend Callback Update | Accept embeddings from Python | 2A |
| **2C** | Kill Fast Lane | Route all files through queue | 2B |
| **2D** | Content Export | Download processed markdown/JSON | 2B |
| **2E** | Drive Sync - Backend | DriveConfig model, sync API, cron | 2C |
| **2F** | Drive Sync - Frontend | UI for Drive folder management | 2E |
| **2G** | Re-embed Migration | Migrate Phase 1 data to new model | 2C |

---

## Part 2A: Python Embedding & Chunking

**Scope:** AI Worker generates embeddings + chunks, sends to backend.

### 2A.1 Install Dependencies

**Files:** `apps/ai-worker/requirements.txt`, `requirements-prod.txt`

**Add:**
```
sentence-transformers>=2.3.0
langchain>=0.3.0
langchain-text-splitters>=0.3.0
```

**Tests:** Build succeeds, imports work

---

### 2A.2 Create Embedder Module

**New file:** `apps/ai-worker/src/embedder.py`

**Functionality:**
- Load `BAAI/bge-small-en-v1.5` model (384d)
- `embed(texts: list[str]) -> list[list[float]]`
- Singleton pattern for model caching
- Env config: `EMBEDDING_MODEL`, `EMBEDDING_DIMENSION`

**Tests (write first):**
```python
# tests/test_embedder.py
def test_embed_returns_384_dimensions():
    result = embedder.embed(["hello world"])
    assert len(result[0]) == 384

def test_embed_batch_consistency():
    single = embedder.embed(["hello"])
    batch = embedder.embed(["hello", "world"])
    assert single[0] == batch[0]

def test_embed_empty_list():
    result = embedder.embed([])
    assert result == []
```

---

### 2A.3 Create Chunker Module

**New file:** `apps/ai-worker/src/chunker.py`

**Functionality:**
- Markdown-aware splitting (LangChain `MarkdownTextSplitter`)
- Config: `chunk_size=1000`, `overlap=200`
- Output: `[{ content, index, metadata: { charStart, charEnd, heading? } }]`

**Tests (write first):**
```python
# tests/test_chunker.py
def test_chunk_respects_size():
    result = chunker.chunk("x" * 2000)
    for chunk in result:
        assert len(chunk["content"]) <= 1000 + 200  # size + overlap

def test_chunk_overlap():
    result = chunker.chunk("x" * 2000)
    # Check overlap between consecutive chunks
    assert result[0]["content"][-200:] in result[1]["content"]

def test_chunk_heading_extraction():
    md = "# Header\n\nContent here"
    result = chunker.chunk(md)
    assert result[0]["metadata"]["heading"] == "Header"
```

---

### 2A.4 Update Processor

**Modify:** `apps/ai-worker/src/processor.py`

**Changes:**
- After Docling conversion → call chunker → call embedder
- Return `processedContent` + `chunks` with embeddings

**Tests (write first):**
```python
# tests/test_processor.py (update existing)
def test_processor_returns_chunks_with_embeddings():
    result = processor.process_pdf("test.pdf")
    assert "chunks" in result
    assert all("embedding" in c for c in result["chunks"])
    assert len(result["chunks"][0]["embedding"]) == 384

def test_processor_returns_processed_content():
    result = processor.process_pdf("test.pdf")
    assert "processedContent" in result
    assert isinstance(result["processedContent"], str)
```

---

### 2A.5 Update Callback Payload

**Modify:** `apps/ai-worker/src/callback.py`

**Changes:**
- Add `processedContent` to payload
- Add `embedding` field to each chunk

**Tests (write first):**
```python
# tests/test_callback.py (update existing)
def test_callback_includes_embeddings():
    payload = callback.build_payload(result)
    assert "chunks" in payload["result"]
    assert all("embedding" in c for c in payload["result"]["chunks"])

def test_callback_includes_processed_content():
    payload = callback.build_payload(result)
    assert "processedContent" in payload["result"]
```

---

## Part 2B: Backend Callback Update

**Scope:** Backend accepts pre-computed embeddings, removes Node.js embedding.

### 2B.1 Update Callback Schema

**Modify:** `apps/backend/src/schemas/callback.ts`

**Changes:**
```typescript
// Add to CallbackResultSchema
processedContent: z.string(),
chunks: z.array(z.object({
  content: z.string(),
  index: z.number(),
  embedding: z.array(z.number()).length(384),  // NEW
  metadata: z.object({...})
}))
```

**Tests:**
```typescript
// tests/unit/schemas/callback.test.ts
test('validates payload with embeddings', () => {
  const valid = CallbackSchema.safeParse(payloadWithEmbeddings);
  expect(valid.success).toBe(true);
});

test('rejects payload without embeddings', () => {
  const invalid = CallbackSchema.safeParse(payloadWithoutEmbeddings);
  expect(invalid.success).toBe(false);
});
```

---

### 2B.2 Update Callback Handler

**Modify:** `apps/backend/src/routes/internal/callback.ts`

**Changes:**
- Remove Fastembed embedding call
- Use `chunks[].embedding` directly
- Store `processedContent` in Document

**Tests:**
```typescript
// tests/integration/callback.test.ts
test('stores embeddings from callback', async () => {
  await callbackHandler(payloadWithEmbeddings);
  const chunks = await db.chunk.findMany({ where: { documentId } });
  expect(chunks[0].embedding).toHaveLength(384);
});

test('stores processedContent', async () => {
  await callbackHandler(payloadWithEmbeddings);
  const doc = await db.document.findUnique({ where: { id: documentId } });
  expect(doc.processedContent).toBeDefined();
});
```

---

### 2B.3 Update Document Model

**Modify:** `apps/backend/prisma/schema.prisma`

**Add fields:**
```prisma
processedContent    String?   @db.Text
processingMetadata  Json?
```

**Run:** `pnpm db:push` or `prisma migrate dev`

---

## Part 2C: Kill Fast Lane

**Scope:** Route ALL files through queue.

### 2C.1 Remove Fast Lane Logic

**Modify:**
- `apps/backend/src/routes/documents/upload.ts`
- `apps/backend/src/services/processor.ts`

**Changes:**
- Remove `lane === 'fast'` branch
- All uploads → queue
- Set `lane = 'heavy'` for all documents

**Tests:**
```typescript
test('JSON file goes to queue', async () => {
  const res = await upload('test.json');
  expect(res.status).toBe('PENDING');
  expect(res.lane).toBe('heavy');
});

test('fast lane code path removed', () => {
  expect(processor.processSync).toBeUndefined();
});
```

---

### 2C.2 Remove Node.js Fastembed

**Modify:** `apps/backend/package.json`

**Remove:** `fastembed` dependency

**Delete:** Embedding service code in backend

---

## Part 2D: Content Export

**Scope:** New endpoint to download processed content.

### 2D.1 Create Content Endpoint

**New file:** `apps/backend/src/routes/documents/content.ts`

**Endpoint:** `GET /api/documents/:id/content?format=markdown|json`

**Tests:**
```typescript
test('returns 404 for non-existent document', async () => {
  const res = await request.get('/api/documents/invalid/content?format=markdown');
  expect(res.status).toBe(404);
});

test('returns 409 for non-completed document', async () => {
  // Create PENDING document
  const res = await request.get(`/api/documents/${pendingDoc.id}/content?format=markdown`);
  expect(res.status).toBe(409);
});

test('returns markdown content', async () => {
  const res = await request.get(`/api/documents/${completedDoc.id}/content?format=markdown`);
  expect(res.headers['content-type']).toContain('text/markdown');
});

test('returns JSON with chunks', async () => {
  const res = await request.get(`/api/documents/${completedDoc.id}/content?format=json`);
  expect(res.body.chunks).toBeDefined();
});
```

---

### 2D.2 Update Document Response

**Modify:** `apps/backend/src/routes/documents/status.ts`

**Add field:** `hasProcessedContent: boolean`

---

## Part 2E: Drive Sync - Backend

**Scope:** DriveConfig model, sync logic, API endpoints.

### 2E.1 Create DriveConfig Model

**Modify:** `apps/backend/prisma/schema.prisma`

```prisma
model DriveConfig {
  id            String    @id @default(uuid())
  folderId      String    @unique
  folderName    String
  syncCron      String    @default("0 */6 * * *")
  recursive     Boolean   @default(true)
  enabled       Boolean   @default(true)
  lastSyncedAt  DateTime?
  pageToken     String?
  syncStatus    String    @default("IDLE")
  syncError     String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  documents     Document[]
  
  @@index([enabled])
}
```

**Update Document model:**
```prisma
sourceType      String    @default("MANUAL")
driveFileId     String?   @unique
driveConfigId   String?
lastSyncedAt    DateTime?
driveConfig     DriveConfig? @relation(fields: [driveConfigId], references: [id], onDelete: SetNull)

@@index([sourceType])
@@index([driveConfigId])
```

---

### 2E.2 Create Drive Service

**New file:** `apps/backend/src/services/drive.ts`

**Functionality:**
- Google Drive API client (Service Account)
- `listFiles(folderId, pageToken?)`
- `downloadFile(fileId, destPath)`
- `getChanges(pageToken)`

---

### 2E.3 Create Sync Service

**New file:** `apps/backend/src/services/sync.ts`

**Functionality:**
- Orchestrate: list → download → create doc → queue
- Incremental sync with Changes API
- Soft delete (ARCHIVED) for removed files

---

### 2E.4 Create Drive Config Endpoints

**New files:**
- `apps/backend/src/routes/drive/configs.ts`
- `apps/backend/src/routes/drive/sync.ts`

**Endpoints:**
```
POST   /api/drive/configs           - Add folder
GET    /api/drive/configs           - List folders
PATCH  /api/drive/configs/:id       - Update settings
DELETE /api/drive/configs/:id       - Remove folder
POST   /api/drive/sync/:configId/trigger - Manual sync
```

---

### 2E.5 Create Cron Job

**New file:** `apps/backend/src/jobs/cron.ts`

**Functionality:**
- Use `node-cron`
- Run sync for enabled DriveConfigs based on `syncCron`

---

## Part 2F: Drive Sync - Frontend

**Scope:** UI for Drive folder management.

### 2F.1 Drive Sync Tab

**New files:**
- `apps/frontend/src/components/DriveSyncTab.tsx`
- `apps/frontend/src/components/DriveConfigList.tsx`
- `apps/frontend/src/components/AddFolderModal.tsx`

**Components:**
- Add Folder button → Modal
- Folder list with settings
- Actions: Edit, Delete, Sync Now

---

### 2F.2 Documents Tab Update

**Modify:** `apps/frontend/src/components/DocumentList.tsx`

**Add:**
- Download button (markdown/JSON)
- Source type indicator
- Filter by Drive folder

---

## Part 2G: Re-embed Migration (DEPRECATED)
**Status:** SKIPPED
**Reason:** User opted to reset development data instead of migrating.

---

## Progress Tracking

| Part | Status | Started | Completed |
|------|--------|---------|-----------|s
| 2A | ⬜ Not Started | - | - |
| 2B | ⬜ Not Started | - | - |
| 2C | ⬜ Not Started | - | - |
| 2D | ⬜ Not Started | - | - |
| 2E | ⬜ Not Started | - | - |
| 2F | ⬜ Not Started | - | - |
| 2G | ⬜ Not Started | - | - |

**Legend:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

---

## Test Commands

```bash
# Part 2A - AI Worker
cd apps/ai-worker && pytest tests/ -v

# Parts 2B-2E - Backend
cd apps/backend && pnpm test

# Full suite
pnpm test

# E2E
docker-compose up -d && cd apps/backend && pnpm test:e2e
```

---

## Estimated Timeline

| Part | Hours | Cumulative |
|------|-------|------------|
| 2A | 2-3 | 3h |
| 2B | 1-2 | 5h |
| 2C | 1 | 6h |
| 2D | 1-2 | 8h |
| 2E | 4-5 | 13h |
| 2F | 2-3 | 16h |
| 2G | 2-3 | 19h |

**Total: ~19-20 hours**
