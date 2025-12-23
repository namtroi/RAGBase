# RAGBase

**Open-source ETL for RAG** | Self-hosted | TDD | Production-ready

Convert PDFs, JSON, TXT → Vector embeddings for semantic search.

---

## Quick Start

### Prerequisites
- Node.js 20 + pnpm 9+
- Docker + Docker Compose
- Python 3.11+ (for AI worker)

### Setup

```bash
# 1. Install
pnpm install

# 2. Configure
cp .env.example .env
# Edit .env: set API_KEY

# 3. Start services
docker compose up -d

# 4. Push schema
pnpm --filter @ragbase/backend db:push

# 5. Run backend
pnpm --filter @ragbase/backend dev

# 6. Run frontend (optional)
pnpm --filter @ragbase/frontend dev

# 7. Verify
curl http://localhost:3000/health
```

---

## Tech Stack

**Backend:** Node.js 20 + Fastify 4.29 + Prisma 7.2  
**AI Worker:** Python 3.11 + FastAPI + Docling  
**Frontend:** React 18 + Vite 7 + Tailwind v4  
**Database:** PostgreSQL 16 + pgvector  
**Queue:** BullMQ + Redis 7  
**Embedding:** Fastembed (all-MiniLM-L6-v2, 384d)  
**Testing:** Vitest + Testcontainers (79% coverage)

---

## Project Structure

```
apps/
├── backend/      # Node.js API
├── ai-worker/    # Python PDF processor
└── frontend/     # React UI

docs/             # Documentation
plans/            # Implementation plans
```

---

## Commands

```bash
# Development
pnpm dev          # All services

# Testing
pnpm test         # All tests
pnpm test:unit    # Unit only
pnpm test:e2e     # E2E only

# Database
pnpm --filter @ragbase/backend db:push     # Push schema
pnpm --filter @ragbase/backend db:generate # Generate client
```

---

## Phase 1 Status: ✅ COMPLETE

- ✅ Backend API (Fastify + Prisma)
- ✅ Python AI Worker (Docling)
- ✅ Frontend UI (React + Tailwind)
- ✅ Production features (logging, metrics, health)
- ✅ 79% test coverage (3,688 lines of tests)

**See:** [plans/2025-12-13-phase1-tdd-implementation/plan.md](plans/2025-12-13-phase1-tdd-implementation/plan.md)

---

## Documentation

- [PRODUCT.md](docs/PRODUCT.md) - Product overview
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - System design
- [API.md](docs/API.md) - API contracts
- [TESTING.md](docs/TESTING.md) - TDD strategy
- [CICD.md](docs/CICD.md) - CI/CD & automation
- [SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md) - Security best practices
- [ROADMAP.md](docs/ROADMAP.md) - Future phases

---

## License

MIT
