# Phase 04: API Routes Integration (TDD)

**Parent:** [plan.md](./plan.md) | **Status:** DONE | **Priority:** P0

## Objectives
Develop official API endpoints; connect Routes - Services - DB via controller pattern.

## Acceptance Criteria
- [ ] POST `/api/documents`: File upload support.
- [ ] GET `/api/documents/:id`: Status retrieval.
- [ ] POST `/api/query`: Vector search execution.
- [ ] API Key middleware for authentication.
- [ ] Integration tests via Testcontainers.

## Key Files
- `src/routes/documents.ts`: Document API logic.
- `src/routes/query.ts`: Query API logic.
- `src/middleware/auth.ts`: Auth middleware.

## Implementation Steps
1. Write Integration Tests for routes (RED).
2. Integrate Zod validation into handlers.
3. Connect Prisma for metadata storage.
4. Mock queues/external services to focus on API logic.

## Verification
- `npm run test:integration`.
- Real test via Postman/Curl in Docker dev.
