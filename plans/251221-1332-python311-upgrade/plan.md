# Python 3.11 Upgrade Plan

**Status:** COMPLETE | **Priority:** P1 | **Branch:** docker/optimize

## Context

Upgrade local dev environment from Python 3.10.12 to 3.11 to match Docker production environment.

**Current State:**
- Local: Python 3.10.12 (Ubuntu 22.04 system)
- Docker: Python 3.11-slim (ai-worker.Dockerfile)
- Dev/prod parity broken

**Goal:** Align local dev to 3.11, verify all deps compatible.

## Phases

- [x] **Phase 01:** Install Python 3.11 → [phase-01-install-python311.md](./phase-01-install-python311.md) ✓ COMPLETED (2025-12-21T13:32)
- [x] **Phase 02:** Create venv & migrate deps → [phase-02-migrate-dependencies.md](./phase-02-migrate-dependencies.md) ✓ COMPLETED (2025-12-21T13:32)
- [x] **Phase 03:** Fix dep conflicts → [phase-03-fix-dependency-conflicts.md](./phase-03-fix-dependency-conflicts.md) ✓ COMPLETED (2025-12-21T14:15)
- [x] **Phase 04:** Validate & test → [phase-04-validate-tests.md](./phase-04-validate-tests.md) ✓ COMPLETED (2025-12-21T15:30)

## Key Dependencies

- Ubuntu 22.04 deadsnakes PPA
- All deps compatible (verified: docling, bullmq, pymupdf work on 3.11)
- Docker already uses 3.11 (no changes needed)

## Success Criteria

- `python --version` → 3.11.x in venv
- All tests pass: `pytest tests/ -v`
- `pip check` → no conflicts
- Dev/prod parity achieved

## Rollback

Keep system Python 3.10 untouched. Venv isolates 3.11. Can delete venv anytime.
