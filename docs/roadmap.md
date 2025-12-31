# RAGBase Roadmap

**6 Phases | MVP → Python-First → Drive Sync → Format Expansion → Production Infra → SaaS Platform**

---

## Overview

| Phase | Status | Focus | Key Deliverables |
|-------|--------|-------|------------------|
| **[Phase 1](./roadmap-phase1.md)** | ✅ Complete | Core Pipeline (MVP) | PDF/Text processing, Vector DB, React UI |
| **[Phase 2](./roadmap-phase2.md)** | ✅ Complete | Python-First Refactor | Unified processing, bge-small-en-v1.5 |
| **[Phase 3](./roadmap-phase3.md)** | ✅ Complete | Drive Sync | Multi-folder sync, service account |
| **[Phase 4](./roadmap-phase4.md)** | ✅ Complete | Format Expansion | 6 new formats, Quality-aware chunking |
| **[Phase 5](./roadmap-phase5.md)** | 📋 Planned | Production Infra | Qdrant Hybrid Search, AES-256 encryption |
| **[Phase 6](./roadmap-phase6.md)** | 📋 Planned | Multi-tenant SaaS | Supabase Auth, Stripe billing, API keys |

---

## Supported File Formats

| Format | Phase | Processor | Chunking Strategy |
|--------|-------|-----------|-------------------|
| `.pdf` (digital) | 1 | Docling | Markdown header-based |
| `.pdf` (scanned) | 1 | Docling + OCR | Markdown header-based |
| `.json` | 1 | Python | Character-based |
| `.txt` | 1 | Python | Character-based |
| `.md` | 1 | Python | Markdown header-based |
| `.docx` | 4 | Docling | Markdown header-based |
| `.xlsx` | 4 | openpyxl | Hybrid table (≤35 rows = 1 chunk) |
| `.csv` | 4 | pandas | Row-based with headers |
| `.pptx` | 4 | Docling | Slide-based |
| `.html` | 4 | BeautifulSoup | Section-aware |
| `.epub` | 4 | ebooklib | Chapter-based |

**Not Supported:** `.doc`, `.ppt` (legacy binary), `.odt`, `.ods`, images, email formats

---

## Phase Summaries

### [Phase 1: Core Pipeline (MVP)](./roadmap-phase1.md) ✅ COMPLETE

**Status:** Complete (2025-12-21)

- PDF/Text → Docling → Markdown → Chunks → Vectors
- Embedding: Fastembed (all-MiniLM-L6-v2, 384-dim)
- Storage: PostgreSQL + pgvector
- Queue: BullMQ (HTTP dispatch pattern)
- UI: React 18 + Tailwind v4 + React Query
- Auth: API key (X-API-Key header)

**Architecture:** Node.js (Fast Lane) + Python (Heavy Lane)

---

### [Phase 2: Python-First Refactor](./roadmap-phase2.md) ✅ COMPLETE

**Goal:** Consolidate ML logic in Python

**Key Changes:**
- Remove Fast Lane → All files via queue
- Move embedding/chunking to Python
- Upgrade model: bge-small-en-v1.5 (better retrieval)
- Hybrid search: Vector + tsvector (BM25)

**Architecture:** All files → BullMQ → Python Worker → Callback → DB

---

### [Phase 3: Google Drive Sync](./roadmap-phase3.md) ✅ COMPLETE

**Goal:** Automated sync from Google Drive folders

**Key Features:**
- Multi-folder Drive sync (service account)
- Incremental sync (change detection)
- Content export endpoint (markdown/JSON)

---

### [Phase 4: Format Expansion](./roadmap-phase4.md) ✅ COMPLETE

**Goal:** Support 6 new formats with format-aware chunking

**New Formats:** DOCX, XLSX, CSV, PPTX, HTML, EPUB

**Chunking Strategies:**
- DOCX/PDF: Markdown header-based with breadcrumbs
- XLSX: Hybrid table (small = 1 chunk, large = sentence serialization)
- CSV: Row-based with headers
- PPTX: Slide-based
- HTML: Section-aware
- EPUB: Chapter-based

**Quality Metrics:** Track chunk type, completeness, token count, quality flags

---

### [Phase 5: Production Infrastructure](./roadmap-phase5.md) 📋 PLANNED

**Goal:** Production-grade security and scalable vector search

**Key Features:**
- **Qdrant Hybrid Search:** Dense (bge-small) + Sparse (SPLADE) with RRF fusion
- **AES-256-GCM:** Encrypt Drive OAuth tokens before storage
- **Outbox Pattern:** Staging → Sync → Cleanup (nullify vectors in PostgreSQL)

**Benefits:**
- Superior retrieval quality (hybrid > pure semantic)
- Massive storage savings (vectors moved to Qdrant)
- Secure credential storage

---

### [Phase 6: Multi-tenant SaaS](./roadmap-phase6.md) 📋 PLANNED

**Goal:** Production SaaS with auth, billing, per-user data

**Key Features:**
- **Auth:** Supabase (no self-managed auth)
- **Authorization:** Single role (User)
- **Billing:** Stripe (Free/Pro/Enterprise)
- **Multi-tenant:** Row-level isolation (tenantId = user.id)
- **Drive OAuth:** Per-user (uses Phase 5 encryption)
- **API Keys:** User-generated for programmatic access
- **Data Export:** JSON archive (GDPR compliance)

**Pricing:**
- Free: 50 docs/month, 500MB, 1 Drive folder
- Pro ($19-29): 1K docs, 10GB, 10 folders
- Enterprise ($99-199): Unlimited, SLA

---

## Technology Stack

| Layer | Phase 1-4 | Phase 5+ |
|-------|-----------|----------|
| **Vector DB** | pgvector | Qdrant (Hybrid) |
| **Embedding** | bge-small-en-v1.5 | + SPLADE (Sparse) |
| **Processing** | Python Worker | Same |
| **Auth** | API key | Supabase JWT (Phase 6) |
| **Drive Sync** | Service Account | Per-user OAuth (Phase 6) |
| **Billing** | N/A | Stripe (Phase 6) |
| **Security** | N/A | AES-256-GCM (Phase 5) |

---

## Database Scaling

| Users | Strategy | Vector DB | Cost/month |
|-------|----------|-----------|------------|
| <10K | Single PostgreSQL + Qdrant | Qdrant Cloud (free tier) | $50-100 |
| 10K-100K | Sharding (10 shards) | Qdrant dedicated | $2K-5K |
| 100K+ | Add shards | Qdrant cluster | Linear scaling |

---

## Out of Scope

- Web scraping (use Drive as intermediary)
- Standalone image processing
- Custom embedding models
- Multi-region deployment
- Real-time webhook sync