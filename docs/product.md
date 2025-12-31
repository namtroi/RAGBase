# RAGBase Product Overview

**Slogan:** _The "Set & Forget" Data Pipeline for Enterprise RAG._  
**(Open Source | Self-Hosted | Structure-Aware | Production-Ready)**

**Status:** Phase 4 Complete | Phase 5 Planned (Qdrant & Security)

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

| Format | Processor | Category |
|--------|-----------|----------|
| `.pdf` (digital/scanned) | Docling + OCR | Document |
| `.docx` | Docling | Document |
| `.txt`, `.md` | TextConverter | Document |
| `.html` | BeautifulSoup + Markdownify | Document |
| `.epub` | EbookLib | Document |
| `.pptx` | Docling | Presentation |
| `.xlsx` | OpenPyXL | Tabular |
| `.csv` | Pandas | Tabular |
| `.json` | TextConverter | Tabular |

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
- **Converters:** Docling (PDF/DOCX/PPTX), BeautifulSoup (HTML), EbookLib (EPUB), OpenPyXL (XLSX), Pandas (CSV)
- **Embedding:** fastembed (Dense: bge-small-en-v1.5, Sparse: SPLADE)
- **Chunking:** LangChain 0.3 (category-aware: document/presentation/tabular)
- **Quality:** Analyzer + Auto-fix (TOO_SHORT, TOO_LONG, NO_CONTEXT, FRAGMENT)
- **HTTP Client:** httpx 0.28

### Frontend (React/TypeScript)
- **Framework:** React 18 + TypeScript 5
- **Build:** Vite 7
- **Styling:** Tailwind CSS v4
- **Data Fetching:** React Query + SSE (real-time updates)

### Storage
- **Primary DB:** PostgreSQL 16+
- **Vector DB:** Qdrant Cloud (Managed Hybrid Search: Dense + Sparse vectors)
- **Cache/Queue:** Redis 7+
- **Security:** AES-256-GCM for encrypted OAuth tokens

---

## 4. System Architecture

**3 Docker Containers:**

1. **`backend`** - Node.js/Fastify orchestrator
   - API routes, validation, queue management
   - HTTP dispatch to AI worker
   - SSE real-time events
   - Google Drive sync
   
2. **`ai-worker`** - Python/FastAPI processor
   - Format converters (PDF, DOCX, PPTX, HTML, EPUB, XLSX, CSV, TXT, MD, JSON)
   - Category-based chunking (document, presentation, tabular)
   - Quality analysis + auto-fix
   - Embedding + HTTP callback to backend
   
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

### Unified Pipeline (Phase 4)

```
Upload (any format) → Queue → Job Processor
    → HTTP Dispatch to AI Worker
        → Router → FormatConverter.to_markdown()
            - PDF/DOCX/PPTX → Docling
            - HTML → BeautifulSoup
            - EPUB → EbookLib
            - XLSX → OpenPyXL
            - CSV → Pandas
            - TXT/MD/JSON → TextConverter
        → Sanitize (null bytes, BOM, mojibake)
        → Chunk (category-based: document/presentation/tabular)
        → Quality Analysis + Auto-fix
        → Embed (bge-small-en-v1.5)
        → HTTP Callback to Backend
    → Store processedContent + chunks + vectors + quality metadata
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

### Phase 3
- ✅ **Document Availability Toggle** - Active/inactive for AI search
- ✅ **Hard Delete** - Complete removal of documents & chunks
- ✅ **Bulk Operations** - Toggle/delete multiple documents
- ✅ **Retry Failed** - Re-queue failed documents
- ✅ **Enhanced Filtering** - Search, sort, filter by state
- ✅ **Drive Re-link** - Auto-reconnect when re-adding folder

### Phase 4 (Current)
- ✅ **10 Format Converters** - PDF, DOCX, PPTX, HTML, EPUB, XLSX, CSV, TXT, MD, JSON
- ✅ **Pre-processing Layer** - Input sanitizer (null bytes, BOM, mojibake) + Markdown normalizer
- ✅ **Category-Based Chunking** - Document (header-aware), Presentation (slide-based), Tabular (row-based)
- ✅ **Quality Analysis** - Flags (TOO_SHORT, TOO_LONG, NO_CONTEXT, FRAGMENT) + Scores (0-1)
- ✅ **Auto-Fix Rules** - Merge short, split long, inject context
- ✅ **Token Count** - Accurate token counts via model tokenizer
- ✅ **Strategy Pattern** - Unified pipeline with router → converter → pipeline flow

### Phase 5 (Planned)
- 📋 **Qdrant Hybrid Search** - Dense + Neural Sparse (SPLADE) with RRF fusion
- 📋 **AES-256-GCM Security** - Millitary-grade encryption for Drive OAuth tokens
- 📋 **Outbox Pattern Sync** - Staging vectors → Sync to Qdrant → Nullify in PostgreSQL

### Phase 6 (Planned)
- 📋 **Multi-tenant SaaS** - Supabase Auth, Stripe billing, Quota enforcement
- 📋 **Per-user Drive OAuth** - Secure individual Drive access
- 📋 **API Keys** - User-generated keys for programmatic access
- 📋 **Data Export** - JSON archive (GDPR compliance)

### Production Features
- ✅ Structured logging (Pino/structlog)
- ✅ Prometheus metrics
- ✅ Health checks (/health, /ready, /live)
- ✅ Rate limiting (100 req/min)
- ✅ Security headers (Helmet)

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

## 10. Extensions

- ✅ **Analytics Dashboard** - Pipeline metrics, quality scores, Chunks Explorer ([extension-analytics-dashboard.md](./extension-analytics-dashboard.md))
- ✅ **Hybrid Search** - Vector + BM25 full-text with RRF reranking ([extension-hybrid-search.md](./extension-hybrid-search.md))
- ✅ **Processing Profiles** - Configurable conversion/chunking/quality parameters ([extension-processing-profile.md](./extension-processing-profile.md))

---

## 11. Documentation

- **[architecture.md](./architecture.md)** - System design & data flow
- **[api.md](./api.md)** - API specifications
- **[detailed-plan-phase4-part1.md](./detailed-plan-phase4-part1.md)** - Format converters + pre-processing
- **[detailed-plan-phase4-part2.md](./detailed-plan-phase4-part2.md)** - Chunking + quality + schema
- **[processing-settings.md](./processing-settings.md)** - Processing configuration reference
- **[roadmap.md](./roadmap.md)** - Product roadmap & future features

---

**Phase 4 Status:** ✅ **COMPLETE** (2025-12-27)
