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

## Phase 1: Core Pipeline (MVP)

**Goal:** PDF/Text → Vector DB working end-to-end.

### Formats

- ✅ `.pdf` (digital + scanned with OCR opt-in)
- ✅ `.json`, `.txt`, `.md` (Fast Lane)

### Scope

| Feature | Details |
|---------|---------|
| Input | Manual upload via API/UI |
| Processing | Docling → Markdown → Chunks |
| Embedding | Self-hosted `all-MiniLM-L6-v2` (384d) |
| Storage | PostgreSQL + pgvector |
| UI | Upload + Status monitor + Simple query |
| Auth | API Key (single key in `.env`) |

### OCR Support (Optional)

```yaml
environment:
  - OCR_ENABLED=${OCR_ENABLED:-false}
  - OCR_LANGUAGES=en,vi  # Multi-language
```

| OCR Mode | Docker Size | Speed | Use Case |
|----------|-------------|-------|----------|
| Disabled | ~2GB | Fast | Digital PDFs only |
| Enabled | ~4GB | 2-5x slower | Scanned documents |

### Tech Decisions

- **Embedding:** Default self-hosted. Optional OpenAI opt-in.
- **Chunking:** 1000 chars, 200 overlap, markdown-aware.
- **Queue:** BullMQ with 3 retries, exponential backoff.
- **OCR:** EasyOCR via Docling (opt-in).

### Schema Additions

```prisma
model Document {
  // ... existing
  failReason  String?  @map("fail_reason")
  retryCount  Int      @default(0) @map("retry_count")
}
```

### Decisions

| Question | Decision |
|----------|----------|
| Max file size | **50MB** default, configurable via `MAX_FILE_SIZE_MB` |
| Password-protected PDF | **Reject** with clear error message |
| Dashboard auth | **Basic password** (single shared password via env) |
| Query endpoint | **Similarity only** (cosine distance, top-K) |

### Config

```yaml
environment:
  - MAX_FILE_SIZE_MB=50
  - DASHBOARD_PASSWORD=your-secret
  - OCR_ENABLED=false
  - OCR_LANGUAGES=en,vi
```

### API Behavior

```typescript
// Password-protected PDF response
{ "error": "PASSWORD_PROTECTED", "message": "Remove password and re-upload." }

// Query endpoint
POST /api/query { "query": "...", "topK": 5 }
→ { "results": [{ "content": "...", "score": 0.89 }] }
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
