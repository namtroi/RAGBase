# **Project Spec: Schema Forge**

**Slogan:** _The "Set & Forget" Data Pipeline for Enterprise RAG._
**(Open Source | Self-Hosted | Structure-Aware | Prisma Powered)**

---

### **1. Overview & Philosophy**

**SchemaForge** is an Open Source ETL system for SMEs. Converts unstructured data (PDFs, Excel) into structured knowledge for Vector Databases.

**Core Philosophy: "Bring Your Own Infrastructure"**

- We provide Docker Images; customer provides Server/Private Cloud.
- 100% data sovereignty. Zero data egress.
- End-to-end Type-safety: TypeScript + Zod + Prisma.

**Development Methodology: Test-Driven Development (TDD)**

- Write tests FIRST, then implement.
- Contracts define interfaces before code. See [CONTRACT.md](./CONTRACT.md).
- Test strategy in [TEST_STRATEGY.md](./TEST_STRATEGY.md).
- Schema/API specs emerge from tests, not upfront design.

---

### **2. Supported File Formats**

| Format | Lane | Processor |
|--------|------|-----------|
| `.pdf` (digital) | Heavy | Docling |
| `.pdf` (scanned) | Heavy | Docling + OCR |
| `.docx` | Heavy | Docling |
| `.xlsx` | Heavy | Python (openpyxl) |
| `.json`, `.txt`, `.md`, `.csv` | Fast | Node.js direct |

**Not Supported:** `.doc`, `.ppt`, `.pptx`, standalone images

---

### **3. Tech Stack**

#### **Backend Orchestrator**
- Node.js + Fastify + TypeScript
- Prisma (ORM) + Zod (validation)
- LangChain.js (chunking) + BullMQ (queue)

#### **AI Engine**
- Python 3.11+ + FastAPI
- Docling (IBM) - PDF/table processing + OCR

#### **Frontend**
- React + Vite + Tailwind CSS (pure)
- TanStack Query (server state)

#### **Storage**
- PostgreSQL 16+ + pgvector
- Embedding: self-hosted `all-MiniLM-L6-v2` (384d) or OpenAI opt-in

---

### **4. System Architecture**

3 Docker containers via internal network:

1. **`app-backend`**: Node.js orchestrator. Cron jobs, validation, task dispatch.
2. **`ai-worker`**: Python worker. Docling processing.
3. **`postgres-db`**: Metadata + vector storage.

> See [ARCHITECTURE.md](./ARCHITECTURE.md) for service communication, embedding pipeline, and error handling details.

---

### **5. Processing Pipeline**

1. **Ingestion**: Upload or Drive sync → MD5 dedup → download new files.
2. **Routing**: Fast Lane (json/txt/md/csv) vs Heavy Lane (pdf/docx/xlsx).
3. **Processing**: Docling → Markdown → LangChain chunking (1000 chars, 200 overlap).
4. **Quality Gate**: Reject if text < 50 chars. Warn if noise > 50%.
5. **Storage**: Prisma → PostgreSQL + pgvector.
6. **Retry**: 3 attempts, exponential backoff. Failed → manual retry.

---

### **6. Key Decisions**

| Area | Decision |
|------|----------|
| File size | 50MB upload, 100MB Drive sync |
| Password PDF | Reject with error |
| OCR | Opt-in via env var |
| Embedding | Self-hosted default, OpenAI opt-in |
| Query | Cosine similarity, top-K |
| Drive sync | Incremental (Changes API), nested folders |
| Deleted files | Soft delete (ARCHIVED) |
| Excel | Hybrid chunking (≤50 rows = 1 chunk) |
| Auth | API Key (MVP) → JWT + RBAC (Phase 3) |
| Metrics | Prometheus on `/metrics` |
| Rate limit | 100 req/min per IP |

---

### **7. Deployment**

| Tier | Files/day | Workers | RAM |
|------|-----------|---------|-----|
| Small | 50 | 2 | 4GB |
| Medium | 500 | 5 | 8GB |
| Large | 2000+ | 10 | 16GB+ |

**Options:**
- Local/On-Premise: Air-gapped, internal server.
- Private Cloud: VPS (AWS, DO) with web dashboard.

---

### **8. Out of Scope**

- Web scraping (customer responsibility)
- Standalone image processing
- Custom embedding models
- Multi-region deployment
- Real-time sync (webhooks)
