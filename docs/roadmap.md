# RAGBase Roadmap

**6 Phases | MVP → Python-First → Drive Sync → Format Expansion → Production Infra → SaaS Platform**

---

## Overview

| Phase | Status | Focus | Key Deliverables |
|-------|--------|-------|------------------|
| **[Phase 1](./archive/roadmap-phase1.md)** | ✅ Complete | Core Pipeline (MVP) | PDF/Text processing, Vector DB, React UI |
| **[Phase 2](./archive/roadmap-phase2.md)** | ✅ Complete | Python-First Refactor | Unified processing, bge-small-en-v1.5 |
| **[Phase 3](./archive/roadmap-phase3.md)** | ✅ Complete | Drive Sync | Multi-folder sync, service account |
| **[Phase 4](./archive/roadmap-phase4.md)** | ✅ Complete | Format Expansion | 6 new formats, Quality-aware chunking |
| **[Phase 5](./archive/roadmap-phase5.md)** | ✅ Complete | Production Infra | Qdrant Hybrid Search, AES-256 encryption |
| **[Phase 6](./archive/roadmap-phase6.md)** | 📋 Planned | Multi-tenant SaaS | Supabase Auth, Stripe billing, API keys |

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

### [Phase 1: Core Pipeline (MVP)](./archive/roadmap-phase1.md) ✅ COMPLETE
<!-- slide -->
### [Phase 2: Python-First Refactor](./archive/roadmap-phase2.md) ✅ COMPLETE
<!-- slide -->
### [Phase 3: Google Drive Sync](./archive/roadmap-phase3.md) ✅ COMPLETE
<!-- slide -->
### [Phase 4: Format Expansion](./archive/roadmap-phase4.md) ✅ COMPLETE
<!-- slide -->
### [Phase 5: Production Infrastructure](./archive/roadmap-phase5.md) ✅ COMPLETE
<!-- slide -->
### [Phase 6: Multi-tenant SaaS](./archive/roadmap-phase6.md) 📋 PLANNED

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