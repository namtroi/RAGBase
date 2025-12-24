# RAGBase Product Overview

**Slogan:** _The "Set & Forget" Data Pipeline for Enterprise RAG._  
**(Open Source | Self-Hosted | Structure-Aware | Production-Ready)**

**Status:** Phase 3 Complete (2025-12-24)

---

## 1. Overview & Philosophy

**RAGBase** is an open-source ETL system that converts unstructured data (PDFs, JSON, TXT, Markdown) into structured knowledge for vector databases.

**Core Philosophy: "Bring Your Own Infrastructure"**

- Docker-based deployment - you provide the server
- 100% data sovereignty - zero data egress
- End-to-end type safety: TypeScript + Zod + Prisma
- Production-ready: logging, metrics, health checks, security

**Development Methodology: Test-Driven Development (TDD)**

- Tests written first, then implementation
- Contracts define interfaces before code
- See [api.md](./api.md) for API specifications

---

## 2. Supported File Formats

| Format | Processor | Status |
|--------|-----------|--------|
| `.pdf` (digital) | Python/Docling | ✅ Phase 1 |
| `.pdf` (scanned) | Docling + OCR | ✅ Phase 1 |
| `.json`, `.txt`, `.md` | Python/TextProcessor | ✅ Phase 2 |
| `.docx` | Docling | 🔜 Phase 4 |

**Processing:** All formats go through BullMQ queue → Python AI Worker (unified pipeline).

---

## 3. Tech Stack

### Backend (Node.js/TypeScript)
- **Framework:** Fastify 4.29
- **ORM:** Prisma 7.2 + PostgreSQL adapter
- **Validation:** Zod 3.23
- **Queue:** BullMQ 5.12 + Redis
- **Real-time:** Server-Sent Events (SSE)
- **Logging:** Pino 9.0 (structured JSON)
- **Metrics:** Prometheus (prom-client 15.1)
- **Security:** Helmet, CORS, rate limiting

### AI Worker (Python/FastAPI)
- **Runtime:** Python 3.11+
- **Framework:** FastAPI 0.126
- **PDF Processing:** Docling 2.15 (IBM)
- **Text Processing:** TextProcessor (MD/TXT/JSON)
- **Embedding:** sentence-transformers (bge-small-en-v1.5, 384d)
- **Chunking:** LangChain 0.3 (markdown-aware)
- **HTTP Client:** httpx 0.28

### Frontend (React/TypeScript)
- **Framework:** React 18 + TypeScript 5
- **Build:** Vite 7
- **Styling:** Tailwind CSS v4
- **Data Fetching:** React Query + SSE (real-time updates)

### Storage
- **Database:** PostgreSQL 16+ with pgvector
- **Vector Search:** Cosine similarity (384d embeddings)
- **Cache/Queue:** Redis 7+

---

## 4. System Architecture

**3 Docker Containers:**

1. **`backend`** - Node.js/Fastify orchestrator
   - API routes, validation, queue management
   - HTTP dispatch to AI worker
   - SSE real-time events
   - Google Drive sync
   
2. **`ai-worker`** - Python/FastAPI processor
   - PDF processing (Docling + OCR)
   - Text processing (MD/TXT/JSON)
   - Embedding + Chunking (Python-first)
   - HTTP callback to backend
   
3. **`postgres` + `redis`** - Data layer
   - PostgreSQL: documents + chunks + vectors + DriveConfig
   - Redis: BullMQ job queue

**Key Architecture: Unified Processing Pipeline (Phase 2)**
- All formats go through queue → AI Worker
- AI Worker handles processing + embedding + chunking
- Eliminates code duplication (single source of truth)

> See [architecture.md](./architecture.md) for detailed system design

---

## 5. Processing Pipeline

### Unified Pipeline (Phase 2)

```
Upload (any format) → Queue → Job Processor
    → HTTP Dispatch to AI Worker
        → Route by format:
            - PDF → Docling (with OCR)
            - MD/TXT/JSON → TextProcessor
        → Chunk (LangChain)
        → Embed (bge-small-en-v1.5)
        → HTTP Callback to Backend
    → Store processedContent + chunks + vectors
    → SSE event to Frontend
```

### Quality Gate
- Reject if extracted text < 50 chars
- Warn if noise ratio > 80%
- Retry failed jobs (max 3 attempts)

---

## 6. Key Features

### Phase 1 (MVP)
- ✅ File upload (multipart/form-data)
- ✅ Duplicate detection (MD5 hash)
- ✅ PDF processing with OCR
- ✅ Vector embeddings (self-hosted)
- ✅ Semantic search (pgvector)
- ✅ Document status tracking

### Phase 2
- ✅ **Unified Processing Pipeline** - All formats via Python AI Worker
- ✅ **Multi-format Support** - PDF, JSON, TXT, MD
- ✅ **SSE Real-time Updates** - Replaced polling with Server-Sent Events
- ✅ **Content Export** - Download processed Markdown/JSON
- ✅ **Google Drive Sync** - Multi-folder auto-sync with Changes API
- ✅ **Upgraded Embedding** - bge-small-en-v1.5 (~10% better retrieval)

### Phase 3 (Current)
- ✅ **Document Availability Toggle** - Active/inactive for AI search
- ✅ **Hard Delete** - Complete removal of documents & chunks
- ✅ **Bulk Operations** - Toggle/delete multiple documents
- ✅ **Retry Failed** - Re-queue failed documents
- ✅ **Enhanced Filtering** - Search, sort, filter by state
- ✅ **Drive Re-link** - Auto-reconnect when re-adding folder

### Production Features
- ✅ Structured logging (Pino/structlog)
- ✅ Prometheus metrics
- ✅ Health checks (/health, /ready, /live)
- ✅ Rate limiting (100 req/min)
- ✅ Security headers (Helmet)
- ✅ API key authentication

---

## 7. Google Drive Sync (Phase 2)

**Features:**
- Multi-folder support (DriveConfig model)
- Incremental sync with Changes API
- MD5 deduplication before download
- Cron-based auto-sync (configurable per folder)
- Soft delete for removed files
- Service Account auth (no user OAuth)

**Sync Behavior:**
- New files → Download + Process + Store
- Modified files → Re-download + Re-process + Replace vectors
- Deleted files → Mark as ARCHIVED (soft delete)

---

## 8. Real-time Updates (Phase 2)

**SSE Events:**
- `document:created` - New document uploaded
- `document:status` - Processing completed/failed
- `sync:start` - Drive sync started
- `sync:complete` - Drive sync finished
- `sync:error` - Drive sync failed

**Frontend Integration:**
- EventProvider with auto-reconnect
- React Query cache invalidation on events
- No more polling (instant updates)

---

## 9. Deployment

### Resource Requirements

| Tier | Files/day | RAM | CPU |
|------|-----------|-----|-----|
| Small | 50 | 4GB | 2 cores |
| Medium | 500 | 8GB | 4 cores |
| Large | 2000+ | 16GB+ | 8+ cores |

### Deployment Options
- **Docker Compose** (development + production)
- **Local/On-Premise:** Air-gapped, internal server
- **Private Cloud:** VPS (AWS, DigitalOcean, etc.)

---

## 10. Documentation

- **[architecture.md](./architecture.md)** - System design & data flow
- **[api.md](./api.md)** - API specifications
- **[detailed-plan-phase3.md](./detailed-plan-phase3.md)** - Phase 3 implementation details
- **[roadmap.md](./roadmap.md)** - Product roadmap & future features

---

**Phase 3 Status:** ✅ **COMPLETE** (2025-12-24)
