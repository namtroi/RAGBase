# Phase 00: Scaffold & Infrastructure

**Parent:** [plan.md](./plan.md) | **Status:** **DONE** | **Priority:** P0

## Objectives
Map project structure and set up basic Docker environment (Backend, AI Worker, Databases).

## Acceptance Criteria
- [x] Standardized monorepo/microservice folder structure (`apps/` prefix).
- [x] Docker Compose runs: PostgreSQL (pgvector), Redis.
- [x] Backend (Node.js/Fastify) connects to DB via Prisma.
- [x] AI Worker (Python/FastAPI) initialized.

## Key Files
- `docker-compose.yml`: Infrastructure config.
- `apps/backend/prisma/schema.prisma`: Basic Data Model.
- `apps/backend/src/app.ts`: Backend entry point.
- `apps/ai-worker/src/main.py`: AI Worker entry point.

## Implementation Steps
1. Init Node.js/TS project with Fastify.
2. Setup Prisma ORM and DB connection.
3. Create `docker-compose.yml` for required containers.
4. Setup AI Worker with basic FastAPI.
5. Verify internal container networking.

## Verification
- Run `docker-compose up -d` & check logs.
- Run `npx prisma db pull/push` to confirm DB connection.
- Check `/health` endpoint on Backend and AI Worker.
