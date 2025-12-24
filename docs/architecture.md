# RAGBase Architecture

**Phase 3 Complete** | **Last Updated:** 2025-12-24

High-level system design & key architectural decisions.

---

## 1. System Overview

### 1.1 Container Architecture

```mermaid
graph TB
    Client[Client/Browser] -->|HTTP| Backend
    Client -->|SSE| Backend
    Backend[Backend<br/>Node.js/Fastify] -->|HTTP Dispatch| AIWorker[AI Worker<br/>Python/FastAPI]
    AIWorker -->|HTTP Callback| Backend
    Backend -->|Prisma ORM| Postgres[(PostgreSQL<br/>+ pgvector)]
    Backend -->|BullMQ| Redis[(Redis)]
    Backend -->|Drive API| GDrive[Google Drive]
    
    style Backend fill:#4CAF50
    style AIWorker fill:#2196F3
    style Postgres fill:#FF9800
    style Redis fill:#F44336
    style GDrive fill:#9C27B0
```

**Components:**

| Container | Technology | Purpose |
|-----------|------------|---------|
| **backend** | Node.js 20 + Fastify 4.29 | API server, queue consumer, SSE events, Drive sync |
| **ai-worker** | Python 3.11 + FastAPI 0.126 | PDF/text processing, embedding, chunking |
| **postgres** | PostgreSQL 16 + pgvector | Documents, chunks, vectors, DriveConfig |
| **redis** | Redis 7 | BullMQ job queue |

---

## 2. HTTP Dispatch Pattern

### 2.1 Unified Processing Pipeline (Phase 2)

```mermaid
sequenceDiagram
    participant U as User/Drive
    participant B as Backend
    participant Q as BullMQ Queue
    participant W as AI Worker
    participant SSE as SSE Clients
    
    U->>B: Upload file (any format)
    B->>B: Validate & Save
    B->>Q: Add job
    B->>SSE: Emit document:created
    
    Note over B,Q: Backend Worker consumes
    Q->>B: Job data
    B->>W: HTTP POST /process (with format)
    
    Note over W: Route by format:<br/>PDF → Docling<br/>MD/TXT/JSON → TextProcessor<br/>Then: Chunk → Embed
    
    W->>B: HTTP POST /internal/callback
    B->>B: Store processedContent + chunks + vectors
    B->>SSE: Emit document:status
```

**Key Points:**
- Backend owns the queue (single consumer)
- All formats (PDF, JSON, TXT, MD) go through queue
- AI Worker handles processing + embedding + chunking
- SSE real-time updates to frontend

---

## 3. Processing Pipeline

### 3.1 Python-First Architecture (Phase 2)

```mermaid
graph LR
    Upload[File Upload] --> Queue[BullMQ Queue]
    Queue --> Dispatch[HTTP Dispatch]
    Dispatch --> AIWorker{AI Worker}
    
    AIWorker -->|PDF| Docling[Docling + OCR]
    AIWorker -->|MD/TXT/JSON| TextProcessor[TextProcessor]
    
    Docling --> Markdown[Markdown Output]
    TextProcessor --> Markdown
    
    Markdown --> Chunk[LangChain Chunking]
    Chunk --> Embed[sentence-transformers<br/>bge-small-en-v1.5]
    Embed --> Callback[HTTP Callback]
    Callback --> Store[(Store in DB)]
    
    style AIWorker fill:#2196F3
    style Docling fill:#4CAF50
    style TextProcessor fill:#4CAF50
```

**Why Python-First?**
- Single source of truth for embedding/chunking
- Better ML ecosystem (sentence-transformers, LangChain)
- Eliminates code duplication (was dual-path in Phase 1)

**Embedding Model:**
- **Library:** sentence-transformers 2.3+
- **Model:** BAAI/bge-small-en-v1.5
- **Dimensions:** 384
- **Upgrade from Phase 1:** all-MiniLM-L6-v2 → bge-small-en-v1.5 (~10% better retrieval)

---

## 4. Real-time Updates (SSE)

### 4.1 Architecture

```mermaid
sequenceDiagram
    participant F as Frontend
    participant B as Backend
    participant E as EventBus
    
    F->>B: GET /api/events?apiKey=xxx
    B->>F: SSE connection established
    
    Note over B: Processing completes
    B->>E: eventBus.emit('document:status', {...})
    E->>B: Broadcast to connections
    B->>F: data: {"type":"document:status",...}
    F->>F: Invalidate React Query cache
```

**Events:**
- `document:created` - New document uploaded
- `document:status` - Processing completed/failed
- `document:deleted` - Document hard deleted (Phase 3)
- `document:availability` - Availability toggled (Phase 3)
- `sync:start` - Drive sync started
- `sync:complete` - Drive sync finished
- `sync:error` - Drive sync failed
- `bulk:completed` - Bulk operation finished (Phase 3)

**Implementation:**
- Backend: In-memory EventEmitter (`EventBus`)
- Auth: Query param (EventSource doesn't support headers)
- Heartbeat: 30s to keep connection alive
- Frontend: Auto-reconnect with exponential backoff

---

## 5. Google Drive Sync

### 5.1 Architecture

```mermaid
graph LR
    Drive[Google Drive] -->|Service Account| Sync[Sync Service]
    Sync -->|Changes API| Detect[Detect Changes]
    Detect --> Fetch[Fetch New Files]
    Fetch --> Queue[BullMQ Queue]
    Queue --> Process[Normal Processing]
    
    style Drive fill:#9C27B0
    style Sync fill:#4CAF50
```

**Key Features:**
- Multi-folder support (DriveConfig model)
- Incremental sync with Changes API + pageToken
- MD5 deduplication before download
- Cron-based scheduling (configurable per folder)
- Soft delete for removed files (status: ARCHIVED)
- Service Account auth (no user OAuth)

---

## 6. Database Architecture

### 6.1 Schema Overview

**Document:** Stores file metadata + processed content
- Phase 2: `processedContent`, `sourceType`, `driveFileId`, `driveConfigId`
- Phase 3: `isActive`, `connectionState`

**Chunk:** Text content + 384d vector embeddings

**DriveConfig (NEW):** Folder sync configuration

### 6.2 Vector Storage (pgvector)

- Operator: `<=>` (cosine distance)
- Index: HNSW for fast similarity search
- Query: Top-K nearest neighbors

---

## 7. Security Architecture

| Pattern | Implementation | Purpose |
|---------|----------------|---------|
| **Timing-Safe Auth** | `crypto.timingSafeEqual()` | Prevent timing attacks |
| **Path Traversal Protection** | `basename()` + MD5 hash | Prevent directory escape |
| **SQL Injection Prevention** | Prisma parameterized queries | Auto-escape input |
| **Input Validation** | Zod SafeParse | Type-safe validation |
| **SSE Auth** | Query param API key | EventSource limitation |

---

## 8. Observability Stack

| Feature | Technology | Purpose |
|---------|------------|---------|
| **Structured Logging** | Pino (Node), structlog (Python) | JSON logs |
| **Metrics** | Prometheus (prom-client) | Custom + default metrics |
| **Health Checks** | /health, /ready, /live | K8s/Docker health probes |
| **Security Headers** | Helmet.js | XSS, clickjacking protection |
| **Rate Limiting** | @fastify/rate-limit | 100 req/min per IP |

---

## 9. Error Handling & Retry

### 9.1 Retry Strategy

```mermaid
graph TD
    Job[Job Failed] --> Retry{Retry Count?}
    Retry -->|< 3| Backoff[Exponential Backoff<br/>5s → 10s → 20s]
    Backoff --> Requeue[Requeue Job]
    
    Retry -->|>= 3| Category{Error Type?}
    Category -->|RETRYABLE| DLQ[Dead Letter Queue]
    Category -->|PERMANENT| Failed[Mark FAILED<br/>No retry]
```

### 9.2 AI Worker Error Codes

- `PASSWORD_PROTECTED` - PDF requires password
- `CORRUPT_FILE` - File cannot be read
- `UNSUPPORTED_FORMAT` - Format not supported
- `OCR_FAILED` - OCR processing failed
- `TIMEOUT` - Processing exceeded time limit
- `INTERNAL_ERROR` - Unexpected error

---

## 10. Frontend Architecture

### 10.1 Real-Time Updates (SSE)

```mermaid
sequenceDiagram
    participant UI as React UI
    participant EP as EventProvider
    participant SSE as SSE Connection
    participant RQ as React Query
    
    UI->>EP: Mount
    EP->>SSE: Connect /api/events
    
    Note over SSE: Event received
    SSE->>EP: document:status
    EP->>RQ: invalidateQueries(['documents'])
    RQ->>UI: Auto-update
```

**Tech Stack:**
- React 18 + TypeScript 5
- Vite 7 (build tool)
- Tailwind CSS v4 (styling)
- React Query (data fetching)
- SSE for real-time updates (replaced polling)

---

## 11. Key Design Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| **Python-First Embedding** | Single source of truth, ML ecosystem | All files queued (1-2s latency) |
| **SSE (not WebSockets)** | Simpler, one-way communication | Auth via query param |
| **HTTP Dispatch Pattern** | Avoids race conditions | AI worker must be running |
| **Drive Service Account** | No user OAuth, server-to-server | Shared access only |
| **Soft Delete** | Preserve history for Drive files | Cleanup needed |
| **Multi-format TextProcessor** | Consistent processing for all | More Python code |

---

## 12. Configuration

### 12.1 Environment Variables

**Backend:**
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_HOST`, `REDIS_PORT` - Redis connection
- `API_KEY` - Authentication secret
- `UPLOAD_DIR` - File storage path
- `AI_WORKER_URL` - AI worker endpoint
- `CALLBACK_URL` - Callback endpoint
- `DRIVE_SERVICE_ACCOUNT_KEY` - Google Drive auth
- `DRIVE_SYNC_CRON` - Default sync schedule

**AI Worker:**
- `PORT` - Server port
- `CALLBACK_URL` - Backend callback endpoint
- `EMBEDDING_MODEL` - BAAI/bge-small-en-v1.5
- `CHUNK_SIZE`, `CHUNK_OVERLAP` - Chunking params

---

**Phase 3 Status:** ✅ COMPLETE (2025-12-24)

**Documentation:**
- [product.md](./product.md) - Product overview
- [api.md](./api.md) - API contracts
- [roadmap-phase3.md](./roadmap-phase3.md) - Phase 3 details

