# CI/CD & Testing Automation

**Phase 5 Complete** | **Updated:** 2026-01-01

---

## 1. Overview

**Test Suite:**
- **Backend:** 52+ test files (unit + integration + e2e)
- **AI Worker:** 26+ test files (pytest)
- **Coverage:** 70-90% depending on module

**Philosophy:** Test-First Development (TDD) - contracts before code, regression safety, living documentation.

---

## 2. GitHub Actions Workflows

### Backend Tests (`backend-tests.yml`)

**Triggers:** Push to `main`, feature branches

**Jobs:**
- **Unit Tests** (~6 min) - Validators, services, business logic
  - Phase 5: `encryption-service`, `qdrant-service`, OAuth validators
- **Integration Tests** (~12-15 min) - Real PostgreSQL + Redis (Testcontainers)
  - Phase 5: `drive-oauth-routes`, `qdrant-sync-queue`
- **E2E Tests** (~15-20 min) - Full pipeline
  - Multi-format flow, OAuth flow, hybrid search

---

### AI Worker Tests (`ai-worker-tests.yml`)

**Triggers:** Changes to `apps/ai-worker/**`

**Jobs:**
- **Pytest** (~10 min) - 26+ test files, 70% coverage threshold
  - Converters: PDF (PyMuPDF + Docling), DOCX, PPTX, HTML, EPUB, XLSX, CSV, TXT, MD, JSON
  - Chunking: Document, Presentation, Tabular
  - Quality: Analyzer + Auto-fix
  - **Phase 5:** Hybrid embeddings (dense + sparse via fastembed)

---

### Docker Build (`docker-build.yml`)

**Triggers:** Push to `main`, release tags

**Jobs:**
- Build backend + AI worker images
- Trivy security scan
- **Note:** Qdrant not built (cloud service)

---

### Lint & Type Check (`lint.yml`)

**Triggers:** All pushes

**Jobs:**
- ESLint + TypeScript (backend/frontend)
- Ruff + Black (AI worker)
- Prisma schema validation

---

## 3. Environment Setup (CI/CD)

**Required Environment Variables:**

```bash
# Database (Testcontainers in CI)
DATABASE_URL=postgresql://...
REDIS_HOST=localhost
REDIS_PORT=6379

# AI Worker
AI_WORKER_URL=http://localhost:8001
CALLBACK_URL=http://localhost:3000

# Phase 5: Security (use test values in CI)
APP_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef  # 32-byte hex
GOOGLE_CLIENT_ID=mock-client-id
GOOGLE_CLIENT_SECRET=mock-client-secret

# Phase 5: Qdrant (mocked in tests)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=test-key
QDRANT_COLLECTION=test-collection
VECTOR_DB_PROVIDER=qdrant
```

**Mock Services:**
- PostgreSQL: Testcontainers (real instance)
- Redis: Testcontainers (real instance)
- Qdrant: Mocked responses (avoid external dependency)
- Google OAuth: Mocked responses

---

## 4. Local Testing

### Quick Tests (Unit Only, ~6 min)
```bash
# Backend unit tests
pnpm --filter backend test:unit

# AI Worker unit tests
cd apps/ai-worker && pytest -m "not integration"
```

### Full Tests (Unit + Integration + E2E, ~30 min)
```bash
# Start dependencies
docker-compose up -d postgres redis

# Backend all tests
pnpm --filter backend test:unit
pnpm --filter backend test:integration
pnpm --filter backend test:e2e

# AI Worker all tests
cd apps/ai-worker && pytest --cov=src --cov-report=html

# Lint + Type check
pnpm lint && pnpm type-check
```

### Phase-Specific Tests
```bash
# Phase 5: OAuth + Encryption
pnpm --filter backend test:unit -- encryption-service
pnpm --filter backend test:integration -- drive-oauth-routes

# Phase 5: Qdrant Sync
pnpm --filter backend test:integration -- qdrant-sync-queue
pnpm --filter backend test:unit -- qdrant-service

# Phase 5: Hybrid Embeddings
cd apps/ai-worker && pytest tests/test_embedder.py -v

# Phase 4: Quality Analysis
cd apps/ai-worker && pytest tests/test_quality_analyzer.py -v
```

---

## 5. Pre-commit Workflow (Recommended)

**Before commit:**
```bash
pnpm lint              # ESLint + Ruff
pnpm type-check        # TypeScript
pnpm --filter backend test:unit  # Quick safety check
```

**Before push:**
```bash
pnpm --filter backend test:integration  # Full backend
cd apps/ai-worker && pytest             # Full AI worker
```

---

## 6. Security & Secrets

### Never Commit
- ❌ `.env` files (production secrets)
- ❌ `APP_ENCRYPTION_KEY` (production keys)
- ❌ OAuth credentials (real Client ID/Secret)
- ❌ Qdrant API keys (production)
- ❌ `uploads/` directory (user files)
- ❌ Database dumps
- ❌ API keys in logs

### Safe to Commit
- ✅ `.env.example` (template)
- ✅ Test fixtures (sample PDFs, CSVs, etc.)
- ✅ GitHub Actions workflows
- ✅ Documentation
- ✅ Mock/test keys (clearly labeled)

### GitHub Secrets (CI/CD)
Store in repository settings:
- `APP_ENCRYPTION_KEY` (test key)
- `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (mock)
- `QDRANT_API_KEY` (mock or test cluster)

**Protection:** `.gitignore` configured ✅

---

## 7. Troubleshooting

### Common Issues by Phase

**Phase 1-3 (Core):**
- **Unit tests fail:** Check test isolation, mock setup
- **Integration tests fail:** Run `pnpm db:push`, verify PostgreSQL/Redis running
- **E2E tests fail:** Check AI Worker logs, Testcontainers timeout

**Phase 4 (Multi-format):**
- **Format converter tests fail:** Verify test fixtures exist in `apps/ai-worker/tests/fixtures/`
- **Quality analyzer tests fail:** Check threshold configurations

**Phase 5 (Production):**
- **OAuth tests fail:** Verify mock Google credentials setup
- **Encryption tests fail:** Check `APP_ENCRYPTION_KEY` is 32-byte hex (64 chars)
- **Qdrant sync tests fail:** Verify Qdrant mock responses configured
- **Hybrid embedding tests fail:** Check `fastembed` installed in AI worker

### CI vs Local Differences
- **Timeout:** CI may be slower, adjust Testcontainers timeout
- **Parallelization:** CI runs tests in parallel, local may be sequential
- **Env vars:** CI uses GitHub Secrets, local uses `.env`
- **Database state:** CI starts fresh, local may have stale data

---

## 8. Performance Benchmarks

| Workflow | Duration | Tests |
|----------|----------|-------|
| **Unit Tests** | ~6 min | Validators, services, business logic |
| **Integration Tests** | ~12-15 min | API routes + DB + Queue (Testcontainers) |
| **E2E Tests** | ~15-20 min | Full pipeline flows |
| **AI Worker** | ~10 min | 26+ test files, all formats |
| **Docker Build** | ~10 min | Build + security scan |
| **Lint** | ~3 min | ESLint + TypeScript + Ruff |

**Total (parallel):** ~30-35 min

**Note:** Phase 5 added ~2-3 min due to OAuth/encryption/Qdrant tests.

---

## 9. Test Coverage by Phase

| Phase | Backend Tests | AI Worker Tests | Key Features |
|-------|---------------|-----------------|--------------|
| **Phase 1-3** | Upload, SSE, Delete, Availability | PDF processing | Core pipeline |
| **Phase 4** | 10 formats, Profiles, Analytics | Chunking, Quality, Auto-fix | Multi-format |
| **Phase 5** | OAuth, Encryption, Qdrant Sync | Hybrid embeddings (dense + sparse) | Production |

**Extensions:**
- Analytics Dashboard: `analytics-api.test.ts`, `test_metrics.py`
- Hybrid Search: `search-route.test.ts`, `hybrid-search.test.ts`
- Processing Profiles: `profile-routes.test.ts`, `test_profile_config.py`

---

## 10. Quick Commands Reference

```bash
# Run all tests
pnpm test                              # Runs test script

# Backend only
pnpm --filter backend test:unit
pnpm --filter backend test:integration
pnpm --filter backend test:e2e
pnpm --filter backend test:coverage    # With coverage report

# AI Worker only
cd apps/ai-worker
pytest                                 # All tests
pytest tests/test_embedder.py -v      # Specific file
pytest --cov=src --cov-report=html    # Coverage HTML report

# Lint + Type check
pnpm lint                              # ESLint + Ruff
pnpm type-check                        # TypeScript only

# Docker
docker-compose up -d                   # Start all services
docker-compose down -v                 # Stop + clean volumes
```

---

**See also:**
- [testing.md](./testing.md) - Test strategy & TDD methodology
- [architecture.md](./architecture.md) - System design
- [api.md](./api.md) - API contracts
