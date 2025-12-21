# Phase 06: E2E Pipeline (TDD)

**Parent:** [plan.md](./plan.md) | **Status:** Complete | **Priority:** P0

## Objectives
Connect all components to form a complete pipeline from Upload to Vector Search.

## Acceptance Criteria
- [x] Standard flow: Upload -> Queue -> (Mock) Python Worker -> Callback -> Embedded -> DB.
- [x] Query API returns correct high-similarity chunks.
- [ ] System handles concurrent multi-file uploads. *(Not implemented - see Notes)*

## Key Files
- `tests/e2e/pipeline/pdf-upload-flow.test.ts`: PDF upload lifecycle test.
- `tests/e2e/pipeline/json-fast-lane.test.ts`: Fast lane (JSON/TXT/MD) processing test.
- `tests/e2e/pipeline/query-flow.test.ts`: Vector search and query validation.
- `tests/e2e/pipeline/error-handling.test.ts`: Error scenarios (password-protected, corrupt, quality gate, duplicate).
- `tests/e2e/setup/e2e-setup.ts`: E2E environment with testcontainers (PostgreSQL + Redis).
- `apps/backend/vitest.e2e.config.ts`: E2E Vitest configuration.
- `apps/backend/src/app.ts`: Final integration config.

## Implementation Summary

### Completed Tests
1. **PDF Upload Flow** (`pdf-upload-flow.test.ts`)
   - Full pipeline: Upload → PENDING → Mock Callback → COMPLETED → Query
   - Heavy lane routing verification

2. **JSON Fast Lane** (`json-fast-lane.test.ts`)
   - JSON processed directly without Python worker
   - TXT and Markdown via fast lane
   - Heading metadata preservation for Markdown

3. **Query Flow** (`query-flow.test.ts`)
   - Semantic query returns relevant results
   - TopK limit respected
   - Results ordered by similarity
   - Metadata included in results
   - Empty results handling

4. **Error Handling** (`error-handling.test.ts`)
   - Password-protected PDF rejection
   - Quality gate: TEXT_TOO_SHORT
   - Quality gate: EXCESSIVE_NOISE
   - Duplicate file detection (409 Conflict)
   - Unsupported format rejection (400)
   - File size limit (413 Payload Too Large)
   - Corrupt file handling

### Test Infrastructure
- Uses `@testcontainers/postgresql` and `@testcontainers/redis`
- Automatic pgvector extension setup
- Prisma schema push (not migrations)
- 120s timeout for container startup

## Verification
- `pnpm --filter @ragbase/backend test:e2e`

## Notes
- **Concurrent multi-file uploads test NOT implemented**: Deferred; current tests focus on happy-path and error handling. Consider adding in future iteration if needed.
- **prisma-test.test.ts excluded**: Simple import test, excluded from E2E config.
