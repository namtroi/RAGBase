# RAGBase Phase 1: TDD Implementation Plan

**Date:** 2025-12-13 | **Branch:** ck/setup | **Methodology:** TDD

---

## Project Context

RAGBase is an open-source ETL system converting unstructured data (PDFs, JSON, TXT) into structured knowledge for vector databases. Phase 1 delivers the MVP: Core Pipeline.

**Key Decisions:**
- 3 Docker containers: app-backend (Node.js), ai-worker (Python), postgres-db + redis
- Embedding in Node.js via @xenova/transformers (384d vectors)
- BullMQ queue with HTTP callback pattern (Python → Node.js)
- Processing lanes: fast (json/txt/md in Node) vs heavy (pdf via Python)

---

## Phase Overview

| Phase | Name | Priority | Status | Est. Hours |
|-------|------|----------|--------|------------|
| 00 | [Scaffold & Infrastructure](./phase-00-scaffold-infrastructure.md) | P0 | Pending | 8 |
| 01 | [Test Infrastructure](./phase-01-test-infrastructure.md) | P0 | Pending | 6 |
| 02 | [Validation Layer (TDD)](./phase-02-validation-layer-tdd.md) | P0 | Pending | 4 |
| 03 | [Business Logic (TDD)](./phase-03-business-logic-tdd.md) | P0 | Pending | 8 |
| 04 | [API Routes Integration (TDD)](./phase-04-api-routes-integration-tdd.md) | P0 | **DONE** | 8 |
| 05 | [Queue & Callbacks (TDD)](./phase-05-queue-callbacks-integration-tdd.md) | P0 | Pending | 6 |
| 06 | [E2E Pipeline (TDD)](./phase-06-e2e-pipeline-tdd.md) | P0 | Pending | 6 |
| 07 | [Python AI Worker](./phase-07-python-ai-worker.md) | P0 | Pending | 10 |
| 08 | [Frontend UI](./phase-08-frontend-ui.md) | P1 | Pending | 8 |
| 09 | [Production Readiness](./phase-09-production-readiness.md) | P1 | Pending | 6 |

**Total Estimated:** ~70 hours

---

## Tech Stack Summary

| Layer | Technology | Version |
|-------|------------|---------|
| Backend | Node.js + Fastify + TypeScript | 20 LTS, 4.x, 5.x |
| ORM | Prisma | 5.7+ |
| Validation | Zod | 3.22+ |
| Queue | BullMQ + Redis | 5.x, 7.x |
| Embedding | @xenova/transformers | 2.6+ |
| Chunking | LangChain.js | 0.1.45+ |
| Python | FastAPI + Docling | 3.11+, latest |
| Database | PostgreSQL + pgvector | 16+, 0.5.1+ |
| Testing | Vitest + Testcontainers | 2.x, latest |

---

## Research Reports

- [TDD Best Practices](./research/researcher-01-tdd-best-practices.md)
- [Vector Embeddings Stack](./research/researcher-02-vector-embeddings-stack.md)

---

## Next Steps

1. Begin Phase 00: Project scaffold and Docker infrastructure
2. Complete Phase 01: Test infrastructure before any implementation
3. Follow strict TDD: RED → GREEN → REFACTOR for phases 02-06

---

## Docs Reference

- [OVERVIEW](../../docs/OVERVIEW.md) | [ROADMAP](../../docs/ROADMAP.md) | [ARCHITECTURE](../../docs/ARCHITECTURE.md)
- [CONTRACT](../../docs/CONTRACT.md) | [TEST_STRATEGY](../../docs/TEST_STRATEGY.md)
