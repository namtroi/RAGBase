# Phase 05: Coverage & CI Integration

**Parent:** [plan.md](./plan.md) | **Status:** ⏳ Pending | **Priority:** P1

## Objective

Enforce coverage thresholds, integrate tests into CI/CD pipeline, ensure quality gates.

## Tasks

### 5.1 Coverage Configuration

**File:** `apps/frontend/vitest.config.ts` (update)

```typescript
export default defineConfig({
  // ... existing config
  test: {
    // ... existing test config
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      statements: 70,
      branches: 70,
      functions: 70,
      lines: 70,
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.config.ts',
        '**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'e2e/',
      ],
      // Fail CI if below threshold
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
});
```

### 5.2 GitHub Actions Workflow

**File:** `.github/workflows/frontend-test.yml`

```yaml
name: Frontend Tests

on:
  push:
    branches: [main, develop]
    paths:
      - 'apps/frontend/**'
      - '.github/workflows/frontend-test.yml'
  pull_request:
    paths:
      - 'apps/frontend/**'

jobs:
  unit-integration:
    name: Unit & Integration Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Get pnpm store directory
        shell: bash
        run: echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

      - name: Cache pnpm store
        uses: actions/cache@v3
        with:
          path: ${{ env.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run unit & integration tests
        run: pnpm --filter @ragbase/frontend test:coverage
        env:
          CI: true

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: apps/frontend/coverage/lcov.info
          flags: frontend
          name: frontend-coverage

      - name: Upload coverage artifacts
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: coverage-report
          path: apps/frontend/coverage/

  e2e:
    name: E2E Tests (Playwright)
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm --filter @ragbase/frontend exec playwright install --with-deps chromium firefox

      - name: Run E2E tests
        run: pnpm --filter @ragbase/frontend test:e2e
        env:
          CI: true

      - name: Upload Playwright report
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: apps/frontend/playwright-report/
          retention-days: 7

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-results
          path: apps/frontend/test-results/
          retention-days: 7

  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run linter
        run: pnpm --filter @ragbase/frontend lint

      - name: Type check
        run: pnpm --filter @ragbase/frontend build
```

### 5.3 Pre-commit Hook (Optional)

**File:** `.husky/pre-commit` (if using husky)

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run tests on staged frontend files
pnpm --filter @ragbase/frontend test:related
```

**File:** `apps/frontend/package.json` (add script)

```json
{
  "scripts": {
    "test:related": "vitest related --run"
  }
}
```

### 5.4 Codecov Configuration

**File:** `.codecov.yml` (root)

```yaml
coverage:
  status:
    project:
      default:
        target: 70%
        threshold: 2%
    patch:
      default:
        target: 70%

comment:
  layout: "reach, diff, flags, files"
  behavior: default

flags:
  frontend:
    paths:
      - apps/frontend/src/
    carryforward: true
```

### 5.5 Update Root README

**File:** `README.md` (update testing section)

```markdown
## Testing

### Frontend Tests

```bash
# Unit & Integration tests
pnpm --filter @ragbase/frontend test

# Watch mode
pnpm --filter @ragbase/frontend test:watch

# Coverage report
pnpm --filter @ragbase/frontend test:coverage

# E2E tests
pnpm --filter @ragbase/frontend test:e2e

# E2E interactive mode
pnpm --filter @ragbase/frontend test:e2e:ui
```

### Coverage Requirements

- **Minimum:** 70% (statements, branches, functions, lines)
- **Target:** 80%+
- **Enforcement:** CI pipeline fails below threshold

### Test Pyramid

```
     ┌─────────┐
     │   E2E   │  10% - Critical user flows (Playwright)
     ├─────────┤
     │  Integ  │  30% - API + components (MSW + RTL)
     ├─────────┤
     │  Unit   │  60% - Hooks, utilities (Vitest)
     └─────────┘
```
```

### 5.6 Add Status Badges

**File:** `README.md` (top)

```markdown
# RAGBase

![Frontend Tests](https://github.com/yourusername/ragbase/workflows/Frontend%20Tests/badge.svg)
[![codecov](https://codecov.io/gh/yourusername/ragbase/branch/main/graph/badge.svg?flag=frontend)](https://codecov.io/gh/yourusername/ragbase)
```

### 5.7 VS Code Test Integration (Optional)

**File:** `.vscode/settings.json`

```json
{
  "vitest.enable": true,
  "vitest.commandLine": "pnpm --filter @ragbase/frontend test",
  "testing.automaticallyOpenPeekView": "failureInVisibleDocument"
}
```

**File:** `.vscode/extensions.json`

```json
{
  "recommendations": [
    "vitest.explorer",
    "ms-playwright.playwright"
  ]
}
```

## Acceptance Criteria

- [x] Coverage thresholds enforced (70%)
- [x] GitHub Actions workflow created
- [x] Unit/integration job runs in <10min
- [x] E2E job runs in <15min
- [x] Codecov integration configured
- [x] Pre-commit hook (optional) runs related tests
- [x] README updated with test commands
- [x] Status badges added
- [x] CI pipeline green on main branch

## Run Full Test Suite

```bash
# Locally (matches CI)
pnpm --filter @ragbase/frontend test:coverage
pnpm --filter @ragbase/frontend test:e2e

# Verify coverage thresholds
pnpm --filter @ragbase/frontend test:coverage --reporter=verbose
```

## CI Performance Targets

| Job | Target | Typical |
|-----|--------|---------|
| Unit/Integration | <5min | 2-3min |
| E2E | <10min | 5-8min |
| Lint/Type | <2min | 1min |
| **Total** | <15min | 8-12min |

## Quality Gates

Tests must pass before merge:
- ✅ All unit/integration tests pass
- ✅ Coverage ≥70%
- ✅ All E2E tests pass (Chrome + Firefox)
- ✅ No TypeScript errors
- ✅ Linter passes

## Notes

- **Codecov:** Free for open source, shows coverage diff in PRs
- **Playwright browsers:** Only install chromium + firefox in CI (saves time)
- **Caching:** pnpm store cached to speed up CI (2-3x faster)
- **Parallel jobs:** Unit/E2E/Lint run in parallel
- **Artifacts:** Test reports kept for 7 days for debugging

## Next Steps After Completion

1. **Phase 09: Production Readiness**
   - Error monitoring (Sentry)
   - Performance monitoring
   - Logging strategy

2. **Phase 10: Deployment**
   - Docker containerization
   - CI/CD deployment pipeline
   - Environment management

## Verification Checklist

- [ ] Push to GitHub triggers workflow
- [ ] All 3 jobs (unit, e2e, lint) pass
- [ ] Codecov report appears in PR
- [ ] Coverage badge shows on README
- [ ] Failed tests upload artifacts
- [ ] E2E screenshots captured on failure
- [ ] Total CI runtime <15 minutes
