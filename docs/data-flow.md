# RAGBase Data Flow

**Phase 5** | Import → Process → Store → Query | **Updated:** 2026-01-01

---

## Overview

```mermaid
graph LR
    A[Upload/Drive OAuth] --> B[Queue]
    B --> C[AI Worker]
    C --> D[Callback]
    D --> E[PostgreSQL]
    D --> F[Qdrant Sync]
    F --> G[Qdrant]
    G --> H[Hybrid Search]
```

---

## 1. Data Import

### 1.1 Manual Upload

**Endpoint:** `POST /api/documents`

```mermaid
sequenceDiagram
    User->>Backend: Upload file
    Backend->>Backend: Validate + MD5 hash
    Backend->>Database: Check duplicate
    alt Duplicate
        Backend->>User: 409 DUPLICATE
    else New
        Backend->>Disk: Save /uploads/{md5}
        Backend->>Database: Document (PENDING)
        Backend->>BullMQ: Add job
        Backend->>User: 201 Created
    end
```

**Validation:**
- Max size: From ProcessingProfile (default 50MB)
- Formats: PDF, DOCX, PPTX, HTML, EPUB, XLSX, CSV, TXT, MD, JSON
- Profile: Active profile snapshot

---

### 1.2 Google Drive Sync (Phase 5 - OAuth)

**OAuth Flow:**
1. `GET /api/oauth/google/url` → User consent
2. `GET /api/oauth/google/callback?code=xxx` → Exchange for tokens
3. Refresh token encrypted with AES-256-GCM → PostgreSQL

**Sync Flow:**
```mermaid
sequenceDiagram
    Cron->>SyncService: Start sync
    SyncService->>Drive API: Changes API (pageToken)
    loop Each new/modified file
        SyncService->>Database: Check MD5
        alt New
            SyncService->>Drive API: Download
            SyncService->>Database: Create Document (DRIVE)
            SyncService->>BullMQ: Add job
        end
    end
    SyncService->>Database: Update pageToken
```

**Modes:**
- **Full**: First run (list all)
- **Incremental**: Changes API with pageToken

---

## 2. Processing Pipeline

### 2.1 Job Dispatch

```typescript
// BullMQ → HTTP POST /process
{
  documentId: string,
  filePath: string,
  format: FileFormat,
  config: ProfileConfig  // From ProcessingProfile
}
```

---

### 2.2 AI Worker Processing

```mermaid
graph TD
    A[Router] --> B{Format}
    B -->|PDF| C[PyMuPDF/Docling]
    B -->|DOCX/PPTX| D[Docling]
    B -->|HTML| E[BeautifulSoup]
    B -->|EPUB| F[EbookLib]
    B -->|XLSX| G[OpenPyXL]
    B -->|CSV| H[Pandas]
    B -->|TXT/MD/JSON| I[Text]
    
    C --> J[Sanitize]
    D --> J
    E --> J
    F --> J
    G --> J
    H --> J
    I --> J
    
    J --> K{Category Chunker}
    K -->|Document| L[Header-based]
    K -->|Presentation| M[Slide-based]
    K -->|Tabular| N[Row-based]
    
    L --> O[Quality Analyzer]
    M --> O
    N --> O
    O --> P[Auto-Fix]
    P --> Q[Hybrid Embedder]
    Q --> R[Callback]
```

**Chunking by Category:**

| Category | Formats | Strategy |
|----------|---------|----------|
| Document | PDF, DOCX, TXT, MD, HTML, EPUB, JSON | Header-based + breadcrumbs |
| Presentation | PPTX | Slide-based grouping |
| Tabular | XLSX, CSV | Row-based |

**Quality Flags:** TOO_SHORT, TOO_LONG, NO_CONTEXT, FRAGMENT, EMPTY  
**Auto-Fix:** Merge short, split long, inject context, skip empty  
**Scoring:** 1.0 - (0.15 × flag count)

---

### 2.3 Hybrid Embedding (Phase 5)

**Library:** `fastembed`  
**Models:**
- Dense: `BAAI/bge-small-en-v1.5` (384d)
- Sparse: `SPLADE` (neural sparse, stateless)

**Output per chunk:**
```python
{
  "content": str,
  "index": int,
  "denseVector": [384 floats],
  "sparseIndices": [int[]],
  "sparseValues": [float[]],
  "metadata": {
    "breadcrumbs": ["Chapter 1"],
    "location": {"page": 1},
    "qualityScore": 0.85,
    "qualityFlags": [],
    "tokenCount": 234,
    "chunkType": "document"
  }
}
```

---

## 3. Storage (Outbox Pattern)

**Endpoint:** `POST /internal/callback`

```mermaid
sequenceDiagram
    AI Worker->>Backend: Callback (content + chunks)
    Backend->>PostgreSQL: Store chunks (syncStatus: PENDING)
    Backend->>PostgreSQL: Create ProcessingMetrics
    Backend->>PostgreSQL: Update Document (COMPLETED)
    Backend->>BullMQ: Trigger qdrant-sync job
    
    Note over BullMQ: Qdrant Sync Queue
    BullMQ->>Qdrant: Batch upsert (dense + sparse)
    Qdrant->>BullMQ: Success
    BullMQ->>PostgreSQL: Update syncStatus=SYNCED
    BullMQ->>PostgreSQL: Nullify vectors (storage savings 90%+)
```

**Chunk Storage (PostgreSQL):**
- Temporary: `denseVector`, `sparseIndices`, `sparseValues` (PENDING)
- Permanent: `content`, `metadata`, `qualityScore`, `breadcrumbs`
- After sync: Vectors → `NULL`, `syncStatus` → `SYNCED`

---

## 4. Database Schema (Key Tables)

### Documents
- `id`, `filename`, `format`, `status`, `format_category`
- `processed_content`, `processing_profile_id`
- `source_type` (MANUAL/DRIVE), `is_active`

### Chunks
- `id`, `document_id`, `content`, `chunk_index`
- `breadcrumbs[]`, `quality_score`, `quality_flags[]`
- `chunk_type`, `token_count`, `location`
- **Phase 5:** `sync_status`, `dense_vector?`, `sparse_indices?`, `sparse_values?`, `qdrant_id?`

### DriveConfig (Phase 5)
- `id`, `user_id`, `encrypted_refresh_token`, `token_iv`, `token_auth_tag`
- `user_email`, `is_connected`, `page_token`

### DriveFolderMapping
- `id`, `drive_config_id`, `folder_id`, `folder_name`
- `sync_cron`, `enabled`, `sync_status`, `processing_profile_id`

### ProcessingProfile
- `id`, `name`, `is_active`, `is_default`
- Conversion: `pdf_converter`, `pdf_ocr_mode`
- Chunking: `document_chunk_size`, `document_chunk_overlap`
- Quality: `quality_min_chars`, `auto_fix_enabled`

### ProcessingMetrics (Analytics)
- `document_id`, `conversion_time_ms`, `chunking_time_ms`, `embedding_time_ms`
- `queue_time_ms`, `total_chunks`, `avg_quality_score`

---

## 5. Retrieval (Qdrant Hybrid Search)

**Endpoint:** `POST /api/query`

**Flow:**
1. Embed query → AI Worker (dense + sparse)
2. Qdrant RRF hybrid search:
   ```json
   {
     "prefetch": [{ "query": sparseVector, "using": "sparse", "limit": topK * 2 }],
     "query": denseVector,
     "using": "dense",
     "limit": topK
   }
   ```
3. Qdrant returns chunk IDs + RRF scores
4. Backend fetches content from PostgreSQL

**Response:**
- `score` - RRF combined score
- `vectorScore` - Dense component (semantic)
- `keywordScore` - Sparse component (SPLADE)

**Modes:**
- `semantic` - Dense only
- `hybrid` - Dense + Sparse with RRF fusion (default)

---

## 6. Deletion & Availability

### Hard Delete
- `DELETE /api/documents/:id` or `POST /api/documents/bulk/delete`
- Deletes: Document + Chunks (cascade) + Disk file + Qdrant vectors

### Availability Toggle
- `PATCH /api/documents/:id/availability`
- `isActive=false` → Excluded from query
- Only COMPLETED documents can be toggled

### Drive Sync Removal
- File removed from Drive → Document persists
- `connectionState` → `STANDALONE`

---

## 7. Key Data Flows

### Upload → Search
```
Upload → Queue → AI Worker (convert + chunk + embed) 
→ Callback → PostgreSQL (PENDING) → Qdrant Sync → SYNCED 
→ Search (Qdrant hybrid) → Results
```

### Drive Sync → Search
```
OAuth → Changes API → Download → Queue → Process 
→ Store → Qdrant → Search
```

### Vector Lifecycle
```
AI Worker generates → PostgreSQL stores (PENDING) 
→ Qdrant Sync uploads → Qdrant indexed 
→ PostgreSQL nullifies vectors (SYNCED) → Storage saved 90%+
```

---

**Phase 5 Status:** ✅ COMPLETE (2026-01-01)

**Key Features:**
- Per-user Drive OAuth with AES-256-GCM encryption
- Hybrid search: Dense (semantic) + Sparse (SPLADE) via Qdrant RRF
- Outbox pattern: Reliable sync + 90%+ storage savings
- 10 format converters with category-based chunking
- Quality analysis + auto-fix + ProcessingProfiles
