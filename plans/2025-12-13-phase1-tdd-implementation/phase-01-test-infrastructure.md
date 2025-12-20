# Phase 01: Test Infrastructure

**Parent:** [plan.md](./plan.md) | **Status:** **DONE** | **Priority:** P0

## Objectives
Setup automated testing (Unit, Integration) using Vitest and Testcontainers for TDD.

## Acceptance Criteria
- [x] Vitest configured in backend (`apps/backend/vitest.config.ts`).
- [x] Testcontainers runs PostgreSQL & Redis for integration tests (`tests/setup/global-setup.ts`).
- [x] Shared root `tests/` directory for fixtures, helpers, and integration tests.
- [x] Pytest infrastructure for AI Worker with coverage reports.
- [x] `npm run test` in backend passes all cases.

## Key Files
- `apps/backend/vitest.config.ts`: Vitest config.
- `tests/setup/global-setup.ts`: Testcontainers & Prisma setup.
- `tests/helpers/database.ts`: DB test utilities (getPrisma, cleanDatabase).
- `apps/ai-worker/pytest.ini`: Pytest configuration.

## Implementation Steps
1. Install Vitest, Testcontainers, and dependencies.
2. Create DB helper for ephemeral test databases.
3. Configure test environment variables.
4. Write sample tests for DB connection.

## Verification
- `npm run test` passes all cases.
- Verify Testcontainers lifecycle in Docker logs.
