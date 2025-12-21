# Phase 04: API Routes Integration (TDD)

**Parent:** [plan.md](./plan.md) | **Status:** DONE | **Priority:** P0

## Objectives
Develop official API endpoints; connect Routes - Services - DB via controller pattern.

## Acceptance Criteria
- [x] POST `/api/documents`: File upload support (`upload-route.ts`).
- [x] GET `/api/documents/:id`: Status retrieval (`status-route.ts`).
- [x] POST `/api/query`: Vector search execution (`search-route.ts`).
- [x] API Key middleware for authentication (`auth-middleware.ts`).
- [x] Integration tests via Testcontainers in `tests/integration/routes/`.
- [x] Internal callback endpoint for AI worker (`callback-route.ts`).

## Key Files
- `apps/backend/src/routes/documents/`: All document-related routes.
- `apps/backend/src/routes/query/search-route.ts`: Search logic.
- `apps/backend/src/middleware/auth-middleware.ts`: Security layer.
- `tests/integration/routes/`: Route integration tests.

## Implementation Steps
1. Write Integration Tests for routes (RED).
2. Integrate Zod validation into handlers.
3. Connect Prisma for metadata storage.
4. Mock queues/external services to focus on API logic.

## Verification
- `npm run test:integration`.
- Real test via Postman/Curl in Docker dev.
