# RAGBase Roadmap

**4 Phases | MVP → Python-First → Format Expansion → SaaS Platform**

---

## Overview

| Phase | Status | Focus | Key Deliverables |
|-------|--------|-------|------------------|
| **[Phase 1](./ROADMAP-PHASE1.md)** | ✅ Complete | Core Pipeline (MVP) | PDF/Text processing, Vector DB, React UI |
| **[Phase 2](./ROADMAP-PHASE2.md)** | 📋 Planned | Python-First + Drive Sync | Unified processing, bge-small-en-v1.5, Drive sync |
| **[Phase 3](./ROADMAP-PHASE3.md)** | 📋 Planned | Format Expansion | 6 new formats, Format-aware chunking |
| **[Phase 4](./ROADMAP-PHASE4.md)** | 📋 Planned | Multi-tenant SaaS | Supabase Auth, Stripe billing, API keys |

---

## Supported File Formats

| Format | Phase | Processor | Chunking Strategy |
|--------|-------|-----------|-------------------|
| `.pdf` (digital) | 1 | Docling | Markdown header-based |
| `.pdf` (scanned) | 1 | Docling + OCR | Markdown header-based |
| `.json` | 1 | Python | Character-based |
| `.txt` | 1 | Python | Character-based |
| `.md` | 1 | Python | Markdown header-based |
| `.docx` | 3 | Docling | Markdown header-based |
| `.xlsx` | 3 | openpyxl | Hybrid table (≤50 rows = 1 chunk) |
| `.csv` | 3 | pandas | Row-based with headers |
| `.pptx` | 3 | Docling | Slide-based |
| `.html` | 3 | BeautifulSoup | Section-aware |
| `.epub` | 3 | ebooklib | Chapter-based |

**Not Supported:** `.doc`, `.ppt` (legacy binary), `.odt`, `.ods`, images, email formats

---

## Phase Summaries

### [Phase 1: Core Pipeline (MVP)](./ROADMAP-PHASE1.md) ✅ COMPLETE

**Status:** Complete (2025-12-21)

- PDF/Text → Docling → Markdown → Chunks → Vectors
- Embedding: Fastembed (all-MiniLM-L6-v2, 384-dim)
- Storage: PostgreSQL + pgvector
- Queue: BullMQ (HTTP dispatch pattern)
- UI: React 18 + Tailwind v4 + React Query
- Auth: API key (X-API-Key header)
- Production: Logging, metrics, health checks

**Architecture:** Node.js (Fast Lane) + Python (Heavy Lane)

---

### [Phase 2: Python-First + Drive Sync](./ROADMAP-PHASE2.md) 📋 PLANNED

**Goal:** Consolidate ML logic in Python, add Drive automation

**Key Changes:**
- Remove Fast Lane → All files via queue
- Move embedding/chunking to Python
- Upgrade model: bge-small-en-v1.5 (better retrieval)
- Multi-folder Drive sync (service account)
- Content export endpoint (markdown/JSON)

**Architecture:** All files → BullMQ → Python Worker → Callback → DB

---

### [Phase 3: Format Expansion](./ROADMAP-PHASE3.md) 📋 PLANNED

**Goal:** Support 6 new formats with format-aware chunking

**New Formats:** DOCX, XLSX, CSV, PPTX, HTML, EPUB

**Chunking Strategies:**
- DOCX/PDF: Markdown header-based
- XLSX: Hybrid table (small = 1 chunk, large = row-based)
- CSV: Row-based with headers
- PPTX: Slide-based
- HTML: Section-aware
- EPUB: Chapter-based

**Quality Metrics:** Track chunk type, completeness, token count

---

### [Phase 4: Multi-tenant SaaS](./ROADMAP-PHASE4.md) 📋 PLANNED

**Goal:** Production SaaS with auth, billing, per-user data

**Key Features:**
- **Auth:** Supabase (no self-managed auth)
- **Authorization:** Single role (User)
- **Billing:** Stripe (Free/Pro/Enterprise)
- **Multi-tenant:** Row-level isolation (tenantId = user.id)
- **Drive OAuth:** Per-user (replaces service account)
- **API Keys:** User-generated for programmatic access
- **Data Export:** JSON archive (GDPR compliance)

**Pricing:**
- Free: 50 docs/month, 500MB, 1 Drive folder
- Pro ($19-29): 1K docs, 10GB, 10 folders
- Enterprise ($99-199): Unlimited, SLA

---

## Technology Stack

| Layer | Phase 1 | Phase 2+ |
|-------|---------|----------|
| **Embedding** | Fastembed (all-MiniLM-L6-v2) | sentence-transformers (bge-small-en-v1.5) |
| **Processing** | Dual path (Node.js + Python) | Python only |
| **Auth** | API key | Supabase JWT (Phase 4) |
| **Drive Sync** | N/A | Service Account → Per-user OAuth |
| **Billing** | N/A | Stripe (Phase 4) |

---

## Database Scaling

| Users | Strategy | Instances | Cost/month |
|-------|----------|-----------|------------|
| <10K | Single DB | 1 | $50-100 |
| 10K-100K | Sharding (10 shards) | 10 | $2K-5K |
| 100K+ | Add shards | N | Linear scaling |

---

## Out of Scope

- Web scraping (use Drive as intermediary)
- Standalone image processing
- Custom embedding models
- Multi-region deployment
- Real-time webhook sync