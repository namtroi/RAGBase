# RAGBase Product Overview

**Slogan:** _The "Set & Forget" Data Pipeline for Enterprise RAG._  
**(Open Source | Self-Hosted | Structure-Aware | Production-Ready)**

**Status:** Phase 1 MVP Complete (2025-12-21)

---

## 1. Overview & Philosophy

**RAGBase** is an open-source ETL system that converts unstructured data (PDFs, JSON, TXT) into structured knowledge for vector databases.

**Core Philosophy: "Bring Your Own Infrastructure"**

- Docker-based deployment - you provide the server
- 100% data sovereignty - zero data egress
- End-to-end type safety: TypeScript + Zod + Prisma
- Production-ready: logging, metrics, health checks, security

**Development Methodology: Test-Driven Development (TDD)**

- Tests written first, then implementation
- 79% test coverage (3,688 lines of tests)
- Contracts define interfaces before code
- See [API.md](./API.md) for API specifications

---

## 2. Supported File Formats

| Format | Lane | Processor | Status |
|--------|------|-----------|--------|
| `.json`, `.txt`, `.md` | Fast | Node.js (immediate) | ✅ Phase 1 |
| `.pdf` (digital) | Heavy | Python/Docling | ✅ Phase 1 |
| `.pdf` (scanned) | Heavy | Docling + OCR | ✅ Phase 1 |
| `.docx` | Future | Docling | 🔜 Phase 2 |
| `.xlsx` | Future | Python (openpyxl) | 🔜 Phase 2 |
| `.csv` | Future | Node.js | 🔜 Phase 2 |

**Not Supported:** `.doc`, `.ppt`, `.pptx`, standalone images

---

## 3. Tech Stack (Phase 1 MVP)

### Backend (Node.js/TypeScript)
- **Framework:** Fastify 4.29
- **ORM:** Prisma 7.2 + PostgreSQL adapter
- **Validation:** Zod 3.23
- **Queue:** BullMQ 5.12 + Redis (backend only)
- **Embedding:** Fastembed 2.0 (all-MiniLM-L6-v2, 384d)
- **Chunking:** LangChain.js 0.3
- **Logging:** Pino 9.0 (structured JSON)
- **Metrics:** Prometheus (prom-client 15.1)
- **Security:** Helmet, CORS, rate limiting (100 req/min)

### AI Worker (Python/FastAPI)
- **Runtime:** Python 3.11+
- **Framework:** FastAPI 0.126
- **PDF Processing:** Docling 2.15 (IBM)
- **HTTP Client:** httpx 0.28 (callbacks)
- **Logging:** structlog 24.4

### Frontend (React/TypeScript)
- **Framework:** React 18 + TypeScript 5
- **Build:** Vite 7
- **Styling:** Tailwind CSS v4
- **Data Fetching:** React Query (polling every 2-3s)
- **HTTP:** Native fetch API

### Storage
- **Database:** PostgreSQL 16+ with pgvector extension
- **Vector Search:** Cosine similarity (384d embeddings)
- **Cache/Queue:** Redis 7+

---

## 4. System Architecture

**3 Docker Containers:**

1. **`backend`** - Node.js/Fastify orchestrator
   - API routes, validation, queue management
   - Fast lane processing (JSON/TXT/MD)
   - HTTP dispatch to AI worker
   
2. **`ai-worker`** - Python/FastAPI processor
   - PDF processing via Docling
   - HTTP callback to backend (no queue access)
   
3. **`postgres` + `redis`** - Data layer
   - PostgreSQL: documents + chunks + vectors
   - Redis: BullMQ job queue (backend only)

**Key Architecture Decision: HTTP Dispatch Pattern**
- Backend owns queue, dispatches PDF jobs to AI worker via HTTP POST
- AI worker processes and sends callback to backend
- Eliminates race conditions (single queue consumer)

> See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design

---

## 5. Processing Pipeline

### Fast Lane (JSON/TXT/MD)
1. Upload → Validation → MD5 dedup
2. **Immediate processing** (synchronous):
   - Read file content
   - Chunk text (1000 chars, 200 overlap)
   - Generate embeddings (Fastembed)
   - Store chunks + vectors in PostgreSQL
3. Status: PENDING → COMPLETED (seconds)

### Heavy Lane (PDF)
1. Upload → Validation → MD5 dedup
2. **Queue for async processing**:
   - Add to BullMQ queue
   - Backend HTTP dispatches to AI worker
   - AI worker processes with Docling
   - AI worker sends callback with markdown
   - Backend chunks + embeds + stores
3. Status: PENDING → PROCESSING → COMPLETED (minutes)

### Quality Gate
- Reject if extracted text < 50 chars
- Warn if noise ratio > 80%
- Retry failed jobs (max 3 attempts)

---

## 6. Key Features (Phase 1)

### Core Functionality
- ✅ File upload (multipart/form-data)
- ✅ Duplicate detection (MD5 hash)
- ✅ Dual-lane processing (fast vs heavy)
- ✅ Vector embeddings (self-hosted)
- ✅ Semantic search (pgvector)
- ✅ Document status tracking
- ✅ Real-time UI updates (polling)

### Production Features
- ✅ Structured logging (Pino/structlog)
- ✅ Prometheus metrics
- ✅ Health checks (/health, /ready, /live)
- ✅ Rate limiting (100 req/min)
- ✅ Security headers (Helmet)
- ✅ CORS configuration
- ✅ Graceful shutdown
- ✅ API key authentication

### Testing
- ✅ Unit tests (843 lines)
- ✅ Integration tests (1,329 lines)
- ✅ E2E tests (803 lines)
- ✅ Python tests (713 lines)
- ✅ Total: 79% test coverage

---

## 7. Deployment

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

> See [ARCHITECTURE.md](./ARCHITECTURE.md) for deployment details

---

## 9. Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design & data flow
- **[ROADMAP.md](./ROADMAP.md)** - Product roadmap & future features
- **[API.md](./API.md)** - API specifications
- **[TEST_STRATEGY.md](./TEST_STRATEGY.md)** - Testing approach
- **[plans/](../plans/)** - Implementation plans & phase details

---

**Phase 1 MVP Status:** ✅ **COMPLETE** (2025-12-21)  
**Total Code:** 4,668 lines production + 3,688 lines tests = 8,356 lines
