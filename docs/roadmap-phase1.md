# Phase 1: Core Pipeline (MVP) ✅ COMPLETE

**Status:** Complete (2025-12-21)  
**Goal:** PDF/Text → Vector DB working end-to-end with production features.

---

## Formats Supported

- ✅ `.pdf` (digital + scanned with OCR)
- ✅ `.json`, `.txt`, `.md` (Fast Lane - immediate processing)

---

## Architecture

**HTTP Dispatch Pattern:**
- Backend → HTTP POST → AI Worker → Callback
- Backend owns BullMQ queue (single consumer)

**Dual-Lane Processing:**
- **Fast Lane:** JSON/TXT/MD → immediate (synchronous)
- **Heavy Lane:** PDF → queue → async processing

---

## Features Delivered

| Feature | Implementation |
|---------|----------------|
| **Input** | Manual upload via API/UI |
| **Processing** | Docling → Markdown → Chunks (LangChain) |
| **Embedding** | Fastembed (all-MiniLM-L6-v2, 384d, self-hosted) |
| **Storage** | PostgreSQL 16 + pgvector |
| **Queue** | BullMQ + Redis (backend only) |
| **UI** | React 18 + Tailwind v4 + React Query polling |
| **Logging** | Pino (Node.js), structlog (Python) - JSON format |
| **Metrics** | Prometheus (/metrics endpoint) |
| **Health** | /health, /ready, /live endpoints |
| **Security** | Helmet, CORS, rate limiting (100 req/min) |

---

## Tech Stack

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

---

## Key Decisions

| Question | Decision |
|----------|----------|
| **Max file size** | 50MB (configurable via `MAX_FILE_SIZE_MB`) |
| **Password-protected PDF** | Reject with `PASSWORD_PROTECTED` error |
| **Embedding** | Fastembed only (self-hosted, no OpenAI) |
| **Queue pattern** | HTTP dispatch (not dual consumers) |
| **Real-time updates** | React Query polling (not WebSockets) |
| **Chunking** | 1000 chars, 200 overlap, markdown-aware |
| **Retry** | 3 attempts, exponential backoff |

---

## Test Coverage

- **Total:** 3,688 lines of tests (79% coverage)
- **Unit:** 843 lines (validation + business logic)
- **Integration:** 1,329 lines (routes + queue)
- **E2E:** 803 lines (full pipeline)
- **Python:** 713 lines (AI worker)

---

## Production Features

- ✅ Structured logging (Pino/structlog)
- ✅ Prometheus metrics
- ✅ Health checks (3 endpoints)
- ✅ Rate limiting (100 req/min)
- ✅ Security headers (Helmet)
- ✅ CORS configuration
- ✅ Graceful shutdown
- ✅ Docker production config

---

## API Endpoints

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
