# Phase 06: E2E Pipeline (TDD)

**Parent:** [plan.md](./plan.md) | **Status:** Pending | **Priority:** P0

## Objectives
Connect all components to form a complete pipeline from Upload to Vector Search.

## Acceptance Criteria
- [ ] Standard flow: Upload -> Queue -> (Mock) Python Worker -> Callback -> Embedded -> DB.
- [ ] Query API returns correct high-similarity chunks.
- [ ] System handles concurrent multi-file uploads.

## Key Files
- `tests/e2e/pipeline.test.ts`: System-wide test scenarios.
- `src/app.ts`: Final integration config.

## Implementation Steps
1. Write E2E tests covering document lifecycle.
2. Fine-tune embedding and chunking parameters.
3. Ensure transaction integrity for vector/metadata storage.

## Verification
- `npm run test:e2e`.
- Manual test: upload PDF -> check `POST /api/query` result.
