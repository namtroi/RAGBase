# Phase 00: Scaffold & Infrastructure

**Parent:** [plan.md](./plan.md) | **Status:** ✅ **DONE** | **Priority:** P0

## Objectives
Establish production-grade monorepo infrastructure with Docker orchestration, database setup, and microservices foundation.

## Acceptance Criteria
- [x] Monorepo structure with pnpm workspaces + Turborepo
- [x] Docker Compose with multi-stage builds (dev, prod)
- [x] PostgreSQL 16 + pgvector extension enabled
- [x] Redis 7 with health checks
- [x] Backend (Fastify) with Prisma 7.2 + new config system
- [x] AI Worker (FastAPI) with HTTP dispatch pattern
- [x] Health/readiness endpoints on all services
- [x] Shared uploads volume for file processing

## Key Files & Components

### Monorepo Configuration
- `pnpm-workspace.yaml`: Workspace definition for apps/*
- `turbo.json`: Build orchestration (dev, build, test tasks)
- `package.json`: Root scripts (dev, build, test, lint)
- `tsconfig.json`: Shared TypeScript config

### Docker Infrastructure
- `docker-compose.yml`: Full-stack orchestration (4 services)
- `docker-compose.dev.yml`: Development-only services (Postgres, Redis)
- `docker-compose.prod.yml`: Production deployment config
- `docker/backend.Dockerfile`: Multi-stage Node.js build
- `docker/ai-worker.Dockerfile`: Multi-stage Python build
- `docker/postgres-init.sql`: pgvector extension setup

### Backend (Node.js/Fastify)
- `apps/backend/src/app.ts`: Application factory with middleware
- `apps/backend/src/index.ts`: Server entry point + graceful shutdown
- `apps/backend/prisma/schema.prisma`: Data model (Document, Chunk, pgvector)
- `apps/backend/prisma.config.ts`: Prisma 7.2 config (new format)
- `apps/backend/src/routes/health-route.ts`: Health/ready/live endpoints
- `apps/backend/src/services/database.ts`: Prisma client singleton

### AI Worker (Python/FastAPI)
- `apps/ai-worker/src/main.py`: FastAPI app with /process endpoint
- `apps/ai-worker/src/processor.py`: PDF processing with Docling
- `apps/ai-worker/src/callback.py`: HTTP callback to backend
- `apps/ai-worker/requirements.txt`: Core dependencies
- `apps/ai-worker/requirements-prod.txt`: Production-only deps

### Environment & Config
- `.env.example`: Template with all config options
- `.env`: Local development config (gitignored)
- `.env.production.template`: Production deployment template

## Implementation Details

### 1. Monorepo Setup
- **Package Manager:** pnpm 9+ with workspace protocol
- **Build System:** Turborepo for task caching and parallelization
- **Structure:** `apps/backend`, `apps/ai-worker`, `apps/frontend`
- **Shared Dependencies:** Testcontainers, Vitest at root level

### 2. Database (PostgreSQL + pgvector)
- **Image:** `pgvector/pgvector:pg16`
- **Extensions:** pgvector enabled via init script
- **Connection:** Prisma 7.2 with new `prisma.config.ts` format
- **Schema:** Document (metadata) + Chunk (embeddings) with vector(384)
- **Health Check:** `pg_isready` with 5s interval

### 3. Queue (Redis + BullMQ)
- **Image:** `redis:7-alpine`
- **Purpose:** Job queue for async PDF processing
- **Health Check:** `redis-cli ping` with 5s interval
- **Integration:** BullMQ worker in backend, HTTP dispatch to AI worker

### 4. Backend Architecture
- **Framework:** Fastify 4.x with TypeScript
- **Middleware:** Security (helmet, CORS), rate limiting, auth, metrics
- **Logging:** Structured logging with Pino (pino-pretty in dev)
- **Graceful Shutdown:** Cleanup for queue, database, worker on SIGTERM
- **Health Endpoints:**
  - `/health`: Basic liveness (always returns 200)
  - `/ready`: Readiness check (DB + Redis + Queue)
  - `/live`: Process liveness probe

### 5. AI Worker Architecture
- **Framework:** FastAPI with async support
- **Pattern:** HTTP dispatch (not queue consumer)
- **Processing:** Docling for PDF → Markdown conversion
- **Callback:** POST to `http://backend:3000/internal/callback`
- **Logging:** Structured logging with structlog

### 6. Docker Networking
- **Network:** Internal bridge network for service-to-service communication
- **Volumes:** 
  - `postgres-data`: Persistent database storage
  - `uploads`: Shared volume for PDF files (backend ↔ ai-worker)
- **Port Mapping:**
  - Backend: 3000 (external)
  - Postgres: 5432 (external for dev tools)
  - Redis: 6379 (external for debugging)

### 7. Multi-Stage Docker Builds
- **Backend:** 
  - Stage 1: Build with pnpm, Prisma generation, TypeScript compilation
  - Stage 2: Production runtime with only prod dependencies
- **AI Worker:**
  - Stage 1: Build with C++ tools for native packages (PyMuPDF, Docling)
  - Stage 2: Slim runtime with only runtime dependencies

## Verification Steps

```bash
# Start infra → Install → Generate Prisma → Push schema → Start dev → Test health
docker compose -f docker-compose.dev.yml up -d
pnpm install
pnpm --filter @ragbase/backend db:generate
pnpm --filter @ragbase/backend db:push
pnpm dev

# Verify
curl http://localhost:3000/health        # {"status":"ok"}
curl http://localhost:3000/ready         # Full health check
curl http://localhost:8000/health        # AI worker (if running)
```

## Critical Notes

### Prisma 7.2 Breaking Change
- `url` in `datasource` block removed → use `prisma.config.ts` with `defineConfig()`
- All CLI commands now read from config file
- Ref: [Prisma 7.2 Migration Guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7)

### Coordinator Pattern (Backend ↔ AI Worker)
- **Decision:** Backend dispatches HTTP to AI worker (not both consuming queue)
- **Why:** Avoids race conditions, simpler error handling
- **Flow:** Upload → Queue → Worker HTTP dispatch → AI processes → Callback
- **Trade-off:** AI worker must be running (not fully async)

### Test Architecture
- **Unit:** `apps/backend/tests/unit/` - Fast, isolated
- **Integration:** `apps/backend/tests/integration/` - Testcontainers
- **E2E:** `tests/e2e/` - Full stack with Docker
- **Isolation:** Separate DB cleanup per suite

### Production Readiness
- Health/readiness probes on all services (`/health`, `/ready`, `/live`)
- Graceful shutdown (SIGTERM handling for queue/DB/worker)
- Structured JSON logging (Pino) + Prometheus metrics (`/metrics`)
- Multi-stage Docker builds for optimized images
- Never commit `.env` - use `.env.production.template`
