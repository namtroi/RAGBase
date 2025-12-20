# Phase 02: Validation Layer (TDD)

**Parent:** [plan.md](./plan.md) | **Status:** Pending | **Priority:** P0

## Objectives
Define Zod schemas for input data (Request Body, Params) to ensure data integrity before business logic.

## Acceptance Criteria
- [ ] Upload schema (types, size limits).
- [ ] Query request schema.
- [ ] AI Worker callback schema.
- [ ] Unit tests for valid/invalid data scenarios.

## Key Files
- `src/schemas/document.schema.ts`: Document schemas.
- `src/schemas/query.schema.ts`: Query schemas.
- `src/middleware/validation.middleware.ts`: Zod integration for Fastify.

## Implementation Steps
1. Write Unit Tests for schemas (RED).
2. Define Zod schemas (GREEN).
3. Test edge cases: large files, invalid formats, missing keys.
4. Refactor for optimization.

## Verification
- `npm run test:unit` for schema files.
