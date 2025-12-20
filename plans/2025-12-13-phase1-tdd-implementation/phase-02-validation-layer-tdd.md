# Phase 02: Validation Layer (TDD)

**Parent:** [plan.md](./plan.md) | **Status:** **DONE** | **Priority:** P0

## Objectives
Define Zod schemas for input data (Request Body, Params) to ensure data integrity before business logic.

## Acceptance Criteria
- [x] Upload schema (types, size limits).
- [x] Query request schema.
- [x] AI Worker callback schema.
- [x] Unit tests for valid/invalid data scenarios in `tests/unit/validators/`.

## Key Files
- `apps/backend/src/validators/upload-validator.ts`: Upload validation logic.
- `apps/backend/src/validators/query-validator.ts`: Search request schemas.
- `apps/backend/src/validators/callback-validator.ts`: Worker response schemas.

## Implementation Steps
1. Write Unit Tests for schemas (RED).
2. Define Zod schemas (GREEN).
3. Test edge cases: large files, invalid formats, missing keys.
4. Refactor for optimization.

## Verification
- `npm run test:unit` for schema files.
