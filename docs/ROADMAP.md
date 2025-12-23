# RAGBase Roadmap

**3 Phases | MVP → Production Ready**

---

## Supported File Formats (All Phases)

| Format | Phase | Lane | Processor |
|--------|-------|------|-----------|
| `.pdf` (digital) | 1 | Heavy | Docling |
| `.pdf` (scanned) | 1 | Heavy | Docling + OCR |
| `.json` | 1 | Fast | Node.js direct |
| `.txt` | 1 | Fast | Node.js direct |
| `.md` (Markdown) | 1 | Fast | Node.js direct |
| `.docx` | 2 | Heavy | Docling |
| `.xlsx` | 3 | Heavy | Python (openpyxl) |
| `.csv` | 3 | Fast | Node.js direct |

**Not Supported:** `.doc`, `.ppt`, `.pptx`, standalone images

---

## Phase 1: Core Pipeline (MVP) ✅ COMPLETE

**Status:** Complete (2025-12-21)  
**Goal:** PDF/Text → Vector DB working end-to-end with production features.

### Formats Supported

- ✅ `.pdf` (digital + scanned with OCR)
- ✅ `.json`, `.txt`, `.md` (Fast Lane - immediate processing)

### Architecture

**HTTP Dispatch Pattern:**
- Backend → HTTP POST → AI Worker → Callback
- Backend owns BullMQ queue (single consumer)

**Dual-Lane Processing:**
- **Fast Lane:** JSON/TXT/MD → immediate (synchronous)
- **Heavy Lane:** PDF → queue → async processing

### Features Delivered

| Feature | Implementation |
|---------|----------------|
| **Input** | Manual upload via API/UI |
| **Processing** | Docling → Markdown → Chunks (LangChain) |
| **Embedding** | Fastembed (all-MiniLM-L6-v2, 384d, self-hosted) |
| **Storage** | PostgreSQL 16 + pgvector |
| **Queue** | BullMQ + Redis (backend only) |
| **UI** | React 18 + Tailwind v4 + React Query polling |
| **Auth** | API Key (X-API-Key header) |
| **Logging** | Pino (Node.js), structlog (Python) - JSON format |
| **Metrics** | Prometheus (/metrics endpoint) |
| **Health** | /health, /ready, /live endpoints |
| **Security** | Helmet, CORS, rate limiting (100 req/min) |

### Tech Stack

**Backend:**
- Node.js 20 + Fastify 4.29
- Prisma 7.2 + PostgreSQL adapter
- Fastembed 2.0 (embeddings)
- BullMQ 5.12 + Redis 7 (backend queue)

**AI Worker:**
- Python 3.11 + FastAPI 0.126
- Docling 2.15 (PDF processing)
- httpx 0.28 (callbacks)

**Frontend:**
- React 18 + TypeScript 5
- Vite 7 + Tailwind CSS v4
- React Query (polling every 2-3s)

### Key Decisions

| Question | Decision |
|----------|----------|
| **Max file size** | 50MB (configurable via `MAX_FILE_SIZE_MB`) |
| **Password-protected PDF** | Reject with `PASSWORD_PROTECTED` error |
| **Embedding** | Fastembed only (self-hosted, no OpenAI) |
| **Queue pattern** | HTTP dispatch (not dual consumers) |
| **Auth** | API key (simple, production-ready) |
| **Real-time updates** | React Query polling (not WebSockets) |
| **Chunking** | 1000 chars, 200 overlap, markdown-aware |
| **Retry** | 3 attempts, exponential backoff |

### Test Coverage

- **Total:** 3,688 lines of tests (79% coverage)
- **Unit:** 843 lines (validation + business logic)
- **Integration:** 1,329 lines (routes + queue)
- **E2E:** 803 lines (full pipeline)
- **Python:** 713 lines (AI worker)

### Production Features

- ✅ Structured logging (Pino/structlog)
- ✅ Prometheus metrics
- ✅ Health checks (3 endpoints)
- ✅ Rate limiting (100 req/min)
- ✅ Security headers (Helmet)
- ✅ CORS configuration
- ✅ Graceful shutdown
- ✅ Docker production config

### API Endpoints

```typescript
// Upload
POST /api/documents (multipart/form-data)

// Status
GET /api/documents/:id

// List
GET /api/documents?status=COMPLETED&limit=20

// Search
POST /api/query { "query": "...", "topK": 5 }

// Health
GET /health, /ready, /live

// Metrics
GET /metrics (Prometheus)

// Internal
POST /internal/callback (AI worker callback)
```


---

## Phase 2: Google Drive Sync

**Goal:** Automated ingestion from Google Drive folders.

### Formats Added

- ✅ `.docx` (Word documents)

### Scope

| Feature | Details |
|---------|---------|
| Trigger | Cron job (default: every 6 hours) |
| Dedup | MD5 hash check before download |
| Formats | PDF, DOCX, TXT, JSON, MD |
| Config | Folder ID, sync frequency via env vars |

### Config Example

```yaml
environment:
  - DRIVE_SYNC_CRON=0 */6 * * *
  - DRIVE_FOLDER_ID=xxx
  - DRIVE_SERVICE_ACCOUNT_KEY=/secrets/sa.json
```

### Auth Strategy

- Service Account (server-to-server, no user OAuth)
- Scopes: `drive.readonly`

### Decisions

| Question | Decision |
|----------|----------|
| Sync strategy | **Incremental** via Changes API (first sync = full) |
| Nested folders | **Supported** (recursive traversal) |
| File size limit | **100MB** for sync (larger than manual upload) |
| Deleted files | **Soft delete** (status = `ARCHIVED`) |

### Config

```yaml
environment:
  - DRIVE_SYNC_CRON=0 */6 * * *
  - DRIVE_FOLDER_ID=xxx
  - DRIVE_RECURSIVE=true
  - DRIVE_MAX_FILE_SIZE_MB=100
  - DRIVE_SERVICE_ACCOUNT_KEY=/secrets/sa.json
```

### Sync Behavior

```typescript
// Incremental sync via Changes API
const changes = await drive.changes.list({ pageToken: lastToken });

// Soft delete on Drive file removal
await prisma.document.update({
  where: { sourceUrl: fileId },
  data: { status: 'ARCHIVED' }
});

// Skip oversized files with warning
if (file.size > limit) logger.warn(`Skipped: ${file.name}`);
```

---

## Phase 3: Excel/CSV + Production Hardening

**Goal:** Tabular data support + enterprise-ready.

### Formats Added

- ✅ `.xlsx` (Excel)
- ✅ `.csv` (CSV - Fast Lane)

### Scope

| Feature | Details |
|---------|---------|
| Processing | Sheet → JSON → Chunks |
| Auth | JWT tokens + RBAC (Admin/Viewer) |
| Scaling | Docker Swarm ready, connection pooling |
| Monitoring | Health checks, basic metrics endpoint |

### Decisions

| Question | Decision |
|----------|----------|
| Excel chunking | **Hybrid** (≤50 rows = 1 chunk, else row-based with headers) |
| Multi-sheet | **All sheets** processed separately with metadata |
| JWT | **Self-issued** RS256, simple RBAC (admin/viewer) |
| Metrics | **Prometheus** format on `/metrics` |
| Rate limiting | **100 req/min** per IP |

### Config

```yaml
environment:
  - JWT_SECRET_KEY=/secrets/jwt.key
  - JWT_EXPIRES_IN=24h
  - RATE_LIMIT_MAX=100
  - RATE_LIMIT_WINDOW=1m
  - EXCEL_CHUNK_ROWS=20
```

### Excel Processing

```typescript
// Hybrid chunking
if (rows <= 50) return [serializeTable(sheet)];
else return chunkByRows(sheet, { size: 20, includeHeaders: true });

// Multi-sheet: each sheet gets metadata
chunk.metadata = { sheetName, sheetIndex };
```

### Auth & Security

```typescript
// JWT payload
interface TokenPayload {
  sub: string;
  role: 'admin' | 'viewer';
}

// Rate limit
fastify.register(rateLimit, { max: 100, timeWindow: '1m' });
```

### Multi-tenant Prep

```prisma
model Document {
  tenantId  String?  @map("tenant_id")
  @@index([tenantId])
}
```

> Not implemented in Phase 3, but schema ready.

---

## Deployment Tiers

| Tier | Files/day | Workers | RAM | Target |
|------|-----------|---------|-----|--------|
| Small | 50 | 2 | 4GB | Startup |
| Medium | 500 | 5 | 8GB | SME |
| Large | 2000+ | 10 | 16GB+ | Enterprise |

---

## Out of Scope (Customer Responsibility)

- Web scraping (use Google Drive as intermediary)
- Standalone image processing (no Vision AI)
- Custom embedding models
- Multi-region deployment
- Real-time sync (webhook-based)