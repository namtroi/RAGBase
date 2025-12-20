# Phase 01: Test Infrastructure

**Parent:** [plan.md](./plan.md) | **Status:** Pending | **Priority:** P0

## Objectives
Setup automated testing (Unit, Integration) using Vitest and Testcontainers for TDD.

## Acceptance Criteria
- [ ] Vitest configured in backend.
- [ ] Testcontainers runs PostgreSQL for integration tests.
- [ ] DB testing fixtures and helpers established.
- [ ] `npm run test` passes initial sample test.

## Key Files
- `vitest.config.ts`: Vitest config.
- `tests/helpers/database.ts`: DB test utilities.
- `tests/setup.ts`: Global setup/teardown.

## Implementation Steps
1. Install Vitest, Testcontainers, and dependencies.
2. Create DB helper for ephemeral test databases.
3. Configure test environment variables.
4. Write sample tests for DB connection.

## Verification
- `npm run test` passes all cases.
- Verify Testcontainers lifecycle in Docker logs.
