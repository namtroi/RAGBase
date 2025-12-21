# Phase 08: Frontend Automation Testing Plan

**Created:** 2025-12-20 | **Status:** Active Plan | **Duration:** 18-26 hours (2-3 days)

## Quick Start

```bash
# View main plan
cat plans/251220-1940-phase08-automation-testing/plan.md

# Start with Phase 1
cat plans/251220-1940-phase08-automation-testing/phase-01-infrastructure-setup.md
```

## Plan Structure

```
251220-1940-phase08-automation-testing/
├── plan.md                           # Main plan (overview, strategy, timeline)
├── phase-01-infrastructure-setup.md  # Vitest, RTL, MSW setup (2-3h)
├── phase-02-unit-tests.md           # Hooks & API client tests (4-5h)
├── phase-03-component-tests.md      # React components + MSW (6-8h)
├── phase-04-e2e-tests.md            # Playwright E2E tests (4-5h)
├── phase-05-ci-integration.md       # Coverage & CI/CD (2-3h)
└── README.md                        # This file
```

## Implementation Order

1. **Phase 1:** Infrastructure Setup → Working test environment
2. **Phase 2:** Unit Tests → 85%+ coverage on hooks/utils
3. **Phase 3:** Component Tests → 80%+ coverage on components
4. **Phase 4:** E2E Tests → 5-8 critical user flows
5. **Phase 5:** CI Integration → Green pipeline, coverage enforcement

## Tech Stack

| Layer | Tool | Why |
|-------|------|-----|
| Test Runner | Vitest | 10-20x faster than Jest |
| Component Testing | React Testing Library | User-focused testing |
| API Mocking | MSW | Network-level, reusable |
| E2E | Playwright | 35-45% faster, multi-browser |
| Coverage | v8 | Native, fast, accurate |

## Testing Pyramid

```
     ┌─────────┐
     │   E2E   │  10% (5-8 scenarios, Playwright)
     ├─────────┤
     │  Integ  │  30% (API + components, MSW)
     ├─────────┤
     │  Unit   │  60% (hooks, utils, pure functions)
     └─────────┘
```

## Success Criteria

- ✅ Coverage ≥70% (target 80%)
- ✅ Test suite runtime <30s (unit + integration)
- ✅ E2E suite runtime <2min
- ✅ Zero flaky tests
- ✅ CI pipeline green
- ✅ All phases completed

## Key Commands (After Setup)

```bash
# Unit & Integration
pnpm --filter @ragbase/frontend test
pnpm --filter @ragbase/frontend test:watch
pnpm --filter @ragbase/frontend test:coverage

# E2E
pnpm --filter @ragbase/frontend test:e2e
pnpm --filter @ragbase/frontend test:e2e:ui

# All tests (CI)
pnpm --filter @ragbase/frontend test:coverage
pnpm --filter @ragbase/frontend test:e2e
```

## Research & References

- **Main Research:** [Frontend Testing 2025](../reports/researcher-251220-frontend-testing-2025.md)
- **Quick Ref:** [Frontend Testing Quick Reference](../reports/frontend-testing-quick-ref.md)
- **Backend Strategy:** [RAGBase Testing Strategy](../../docs/core/testing-strategy.md)
- **Phase 08 Implementation:** [Frontend UI Plan](../2025-12-13-phase1-tdd-implementation/phase-08-frontend-ui.md)

## Dependencies to Install

```bash
cd apps/frontend
pnpm add -D \
  vitest @vitest/ui \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom \
  jsdom msw \
  @playwright/test
```

## Timeline Estimate

| Phase | Hours | Cumulative |
|-------|-------|------------|
| 1. Setup | 2-3h | 2-3h |
| 2. Unit tests | 4-5h | 6-8h |
| 3. Integration | 6-8h | 12-16h |
| 4. E2E | 4-5h | 16-21h |
| 5. CI/CD | 2-3h | 18-24h |
| **Buffer** | 2h | **20-26h** |

## Notes

- MSW handlers work in both dev and test environments
- TanStack Query tests require `QueryClientProvider` wrapper
- Playwright runs tests in parallel (4x speedup)
- Coverage enforced at 70% minimum, aim for 80%+
- All configs provided in phase files (copy-paste ready)

## Current Status

**Phase:** Planning Complete ✅
**Next Action:** Begin Phase 1 - Infrastructure Setup
**Blocker:** None

## Unresolved Questions

None at this time. All requirements clear based on completed phase-08 implementation.

---

**Plan Owner:** Claude
**Last Updated:** 2025-12-20
**Plan Type:** Implementation Plan (TDD)
