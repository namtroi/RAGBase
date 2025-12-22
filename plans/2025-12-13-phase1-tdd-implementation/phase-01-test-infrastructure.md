# Phase 01: Test Infrastructure

**Parent:** [plan.md](./plan.md) | **Status:** ✅ **DONE** | **Priority:** P0

## Objectives
Establish comprehensive TDD infrastructure with Vitest, Testcontainers, pytest, and sophisticated mocking system for unit, integration, and E2E tests.

## Acceptance Criteria
- [x] Vitest configured with unit/integration/E2E separation
- [x] Testcontainers for PostgreSQL + Redis (isolated test environments)
- [x] Pytest infrastructure with async support and coverage
- [x] Test helpers (database, API, fixtures)
- [x] Mock system (BullMQ, embeddings, Python worker)
- [x] 30+ backend tests, 4 Python tests
- [x] Coverage reporting (80% threshold for backend)
- [x] Sequential test execution to avoid race conditions

## Key Files & Components

### Backend Test Configuration
- `apps/backend/vitest.config.ts`: Main config (unit + integration)
- `apps/backend/vitest.e2e.config.ts`: E2E-specific config
- `apps/backend/tests/tsconfig.json`: TypeScript config for tests

### Test Setup & Lifecycle
- `apps/backend/tests/setup/global-setup.ts`: Testcontainers startup + Prisma migrations
- `apps/backend/tests/setup/setup-file.ts`: Per-file setup (Prisma reset, mock cleanup)

### Test Helpers
- `apps/backend/tests/helpers/database.ts`: DB utilities (cleanDatabase, seedDocument, seedChunk)
- `apps/backend/tests/helpers/api.ts`: Fastify test client (getTestApp, inject, authHeaders)
- `apps/backend/tests/helpers/fixtures.ts`: Fixture loading (PDF, JSON, text, markdown)

### Mocking System
- `apps/backend/tests/mocks/bullmq-mock.ts`: In-memory queue (MockQueue, MockWorker)
- `apps/backend/tests/mocks/embedding-mock.ts`: Embedding service mock
- `apps/backend/tests/mocks/python-worker-mock.ts`: AI worker HTTP mock

### Test Suites (30+ tests)
- `apps/backend/tests/unit/`: Fast, isolated tests (validators, services, helpers)
- `apps/backend/tests/integration/`: DB + Redis tests (routes, queue, middleware)
- `apps/backend/tests/e2e/`: Full-stack tests (upload flow, query flow, error handling)

### AI Worker Test Infrastructure
- `apps/ai-worker/pytest.ini`: Pytest config with async mode and coverage
- `apps/ai-worker/tests/conftest.py`: Pytest fixtures (fixtures_dir, sample_pdf_path, mock_settings)
- `apps/ai-worker/tests/test_*.py`: 4 test files (main, processor, callback, consumer)

### Test Fixtures
- `apps/backend/tests/fixtures/pdfs/`: Sample PDFs (digital, multi-page, scanned, corrupt)
- `apps/backend/tests/fixtures/json/`: JSON files (valid, malformed)
- `apps/backend/tests/fixtures/text/`: Text files (normal, unicode, empty)
- `apps/backend/tests/fixtures/markdown/`: Markdown files (headers, code blocks)

## Implementation Details

### 1. Testcontainers Setup
- PostgreSQL (`pgvector/pgvector:pg16`) + Redis (`redis:7-alpine`)
- Containers start once, shared across tests, auto-teardown
- Prisma migrations via `pnpm db:push` in global setup

### 2. Test Isolation
- Sequential execution (`fileParallelism: false`) prevents race conditions
- `cleanDatabase()` in beforeEach/afterEach + `vi.clearAllMocks()`
- Prisma singleton ensures tests/source use same DB connection

### 3. Coverage
- V8 provider with text/JSON/HTML reports
- Thresholds: 80% statements/functions/lines, 75% branches
- Excludes: `src/index.ts`, type definitions

### 4. Mock Architecture
- **BullMQ:** In-memory queue with event emitters (no Redis for unit tests)
- **Embeddings:** Fake vectors for fast tests
- **Python Worker:** HTTP server mock for AI responses
- Auto-cleanup via `vi.clearAllMocks()`

### 5. Test Helpers
- **Database:** Re-exports from source (single Prisma instance)
- **API:** Lazy-initialized Fastify app, shared per file
- **Fixtures:** Path resolution + buffer/text loading
- **Auth:** X-API-Key header helper

### 6. E2E Config
- Separate `vitest.e2e.config.ts` with 2min timeouts
- Each suite manages own containers (no global setup)
- Sequential execution to avoid port conflicts

### 7. Python Tests
- Async mode (`asyncio_mode = auto`) for FastAPI
- HTML + terminal coverage with missing lines
- Fixtures for paths and mock settings

## Verification

```bash
pnpm --filter @ragbase/backend test:unit         # Fast, no containers
pnpm --filter @ragbase/backend test:integration  # With Testcontainers
pnpm --filter @ragbase/backend test:e2e          # Full stack
pnpm --filter @ragbase/backend test              # All tests
cd apps/ai-worker && pytest                      # Python tests
pnpm --filter @ragbase/backend test -- --coverage # Coverage report
```

## Critical Notes

### Testcontainers Lifecycle
- Start once in `global-setup.ts`, shared across tests (faster)
- Auto-teardown via cleanup function
- `DATABASE_URL`/`REDIS_URL` set dynamically

### Prisma Singleton Pattern
- Tests and source must use SAME instance
- Re-export from `@/services/database.js` ensures single connection
- Ref: `docs/TYPESCRIPT_PATH_FIX.md`

### Race Condition Prevention
- `fileParallelism: false` - parallel tests cause DB conflicts
- Trade-off: slower but 100% reliable
- E2E: each suite spins up own containers (must be sequential)

### Test Strategy
- **Unit:** Mocks (BullMQ, embeddings) - fast, isolated
- **Integration:** Testcontainers (real DB/Redis) - realistic
- **E2E:** Docker Compose (full stack) - production-like

### Coverage Enforcement
- Tests fail if below 80% threshold
- HTML report in `coverage/` directory
- JSON for CI/CD integration
