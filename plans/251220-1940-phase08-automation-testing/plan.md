# Phase 08: Frontend Automation Testing

**Status:** 📝 Planning | **Priority:** P1 | **Parent Plan:** [Phase 1 TDD Implementation](../2025-12-13-phase1-tdd-implementation/plan.md)

## Context

Phase 08 frontend UI implementation is complete (React 18 + Vite 7 + TanStack Query v5) but lacks automated testing. Current implementation includes:

- **Components:** Upload dropzone, document list, search form, results display
- **Hooks:** `useDocuments`, `useQuery` for API integration
- **API Layer:** Fetch wrapper, endpoints for documents/query
- **Features:** Drag-drop upload, real-time status polling, vector search UI

**No tests exist.** Need comprehensive test coverage following RAGBase TDD principles.

## Objectives

Implement automated testing for Phase 08 frontend:

1. **Unit tests:** Components, hooks, utilities (60% of pyramid)
2. **Integration tests:** API + components + TanStack Query (30%)
3. **E2E tests:** Critical user flows (10%)
4. **Coverage:** 70-80% realistic target
5. **CI/CD:** Fast, reliable test pipeline

## Test Strategy

### Testing Pyramid

```
     ┌─────────┐
     │   E2E   │  ← 10% (Playwright: upload→search flow)
     ├─────────┤
     │  Integ  │  ← 30% (API + components + MSW)
     ├─────────┤
     │  Unit   │  ← 60% (hooks, components, utils)
     └─────────┘
```

### Tech Stack (Research-backed)

| Layer | Tool | Rationale |
|-------|------|-----------|
| Test runner | **Vitest** | 10-20x faster than Jest, native ESM, Vite parity |
| Component testing | **React Testing Library** | User-focused, `renderHook` built-in |
| API mocking | **MSW** | Network-level, reusable dev/test/E2E |
| E2E testing | **Playwright** | 35-45% faster, multi-browser |
| Coverage | **v8** (Vitest built-in) | Native, fast, accurate |

Research: [Frontend Testing 2025](../reports/researcher-251220-frontend-testing-2025.md)

## Implementation Phases

### Phase 1: Test Infrastructure Setup
**Goal:** Configure Vitest, RTL, MSW foundation

- [ ] Install dependencies (vitest, @testing-library/react, MSW, @vitest/ui)
- [ ] Create `vitest.config.ts` (jsdom, coverage, globals)
- [ ] Setup test utilities (`test/setup.ts`, `test/test-utils.tsx`)
- [ ] Configure MSW handlers for backend API mocking
- [ ] Add npm scripts: `test`, `test:watch`, `test:coverage`, `test:ui`
- [ ] Verify setup with smoke test

**Duration:** 2-3 hours | **Deliverable:** Working test environment

---

### Phase 2: Unit Tests - Utilities & Hooks
**Goal:** Test pure functions and custom hooks (60% pyramid base)

#### 2.1 API Client Tests (`api/client.ts`)
- [ ] Test fetch wrapper error handling
- [ ] Test API key header injection
- [ ] Test response parsing (success/error)
- [ ] Test request timeout handling

#### 2.2 Custom Hooks Tests
**`hooks/use-documents.ts`:**
- [ ] `useDocuments`: fetch list, filter by status, polling behavior
- [ ] `useDocument`: fetch single, polling while PENDING/PROCESSING
- [ ] `useUploadDocument`: mutation success/error, optimistic updates

**`hooks/use-query.ts`:**
- [ ] `useSearch`: query execution, topK parameter
- [ ] Error state handling
- [ ] Empty results handling

**Testing pattern:**
```typescript
// Use TanStack Query testing utilities
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const wrapper = ({ children }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

test('useDocuments fetches documents', async () => {
  const { result } = renderHook(() => useDocuments(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toHaveLength(3);
});
```

**Duration:** 4-5 hours | **Coverage Target:** 85%+

---

### Phase 3: Component Integration Tests
**Goal:** Test components with real TanStack Query + MSW (30% pyramid)

#### 3.1 Document Upload Flow
**`components/documents/upload-dropzone.tsx`:**
- [ ] Drag-drop file triggers upload
- [ ] File validation (size, type)
- [ ] Upload progress display
- [ ] Success/error states
- [ ] Multiple file handling

#### 3.2 Document List
**`components/documents/document-list.tsx`:**
- [ ] Renders document cards
- [ ] Status filter (ALL/PENDING/COMPLETED/FAILED)
- [ ] Empty state display
- [ ] Polling behavior (MSW simulates status changes)
- [ ] Document card click interaction

#### 3.3 Search Flow
**`components/query/search-form.tsx`:**
- [ ] Input validation
- [ ] topK selector
- [ ] Submit triggers query

**`components/query/results-list.tsx`:**
- [ ] Displays results with scores
- [ ] Empty state (no matches)
- [ ] Loading state
- [ ] Result card rendering

#### 3.4 Status Badge
**`components/documents/status-badge.tsx`:**
- [ ] Correct color for each status
- [ ] Icon display
- [ ] Accessibility (aria-label)

**Testing pattern:**
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer(
  http.get('/api/documents', () => {
    return HttpResponse.json([
      { id: '1', status: 'COMPLETED', filename: 'test.pdf' }
    ]);
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('document list displays documents', async () => {
  render(<DocumentList />, { wrapper: QueryWrapper });
  await waitFor(() => {
    expect(screen.getByText('test.pdf')).toBeInTheDocument();
  });
});
```

**Duration:** 6-8 hours | **Coverage Target:** 80%+

---

### Phase 4: E2E Critical Flows (Playwright)
**Goal:** Test complete user journeys (10% pyramid)

#### 4.1 Setup Playwright
- [ ] Install Playwright (`pnpm create playwright`)
- [ ] Configure `playwright.config.ts` (baseURL, browser matrix)
- [ ] Setup test fixtures (auth, API mocking)
- [ ] Create page object models (POM) for maintainability

#### 4.2 Test Scenarios

**E2E-01: Upload → Process → View**
```typescript
test('upload PDF and view processing status', async ({ page }) => {
  await page.goto('/');

  // Upload file
  await page.setInputFiles('input[type="file"]', 'fixtures/test.pdf');
  await expect(page.getByText('test.pdf')).toBeVisible();

  // Wait for processing (poll status)
  await expect(page.getByText('COMPLETED')).toBeVisible({ timeout: 10000 });

  // Verify chunk count
  await expect(page.getByText('15 chunks')).toBeVisible();
});
```

**E2E-02: Search Flow**
```typescript
test('search returns relevant results', async ({ page }) => {
  await page.goto('/');

  // Navigate to search tab
  await page.click('text=Search');

  // Enter query
  await page.fill('input[placeholder="Enter your query"]', 'machine learning');
  await page.selectOption('select[name="topK"]', '10');
  await page.click('button:has-text("Search")');

  // Verify results
  await expect(page.getByTestId('result-card')).toHaveCount(10);
  await expect(page.getByText('Score:')).toBeVisible();
});
```

**E2E-03: Error Handling**
```typescript
test('displays error for invalid file', async ({ page }) => {
  await page.goto('/');

  // Upload invalid file
  await page.setInputFiles('input[type="file"]', 'fixtures/invalid.exe');

  // Verify error message
  await expect(page.getByText('Unsupported file type')).toBeVisible();
});
```

**Duration:** 4-5 hours | **Scenarios:** 5-8 critical paths

---

### Phase 5: Coverage & CI Integration
**Goal:** Enforce quality gates, automate in CI/CD

#### 5.1 Coverage Configuration
```typescript
// vitest.config.ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'html', 'lcov'],
  statements: 70,
  branches: 70,
  functions: 70,
  lines: 70,
  exclude: [
    'node_modules/',
    'src/test/',
    '**/*.config.ts',
    '**/*.d.ts',
  ],
}
```

#### 5.2 CI Pipeline (GitHub Actions)
```yaml
# .github/workflows/frontend-test.yml
name: Frontend Tests

on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --filter @ragbase/frontend
      - run: pnpm --filter @ragbase/frontend test:coverage
      - uses: codecov/codecov-action@v3

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --filter @ragbase/frontend
      - run: pnpm --filter @ragbase/frontend playwright install --with-deps
      - run: pnpm --filter @ragbase/frontend test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: apps/frontend/playwright-report/
```

#### 5.3 Pre-commit Hooks (optional)
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "pnpm --filter @ragbase/frontend test:related"
    }
  }
}
```

**Duration:** 2-3 hours | **Deliverable:** Green CI pipeline

---

## Test Organization

### Directory Structure
```
apps/frontend/
├── src/
│   ├── components/
│   │   └── __tests__/
│   │       ├── upload-dropzone.test.tsx
│   │       ├── document-list.test.tsx
│   │       └── search-form.test.tsx
│   ├── hooks/
│   │   └── __tests__/
│   │       ├── use-documents.test.ts
│   │       └── use-query.test.ts
│   ├── api/
│   │   └── __tests__/
│   │       └── client.test.ts
│   └── test/
│       ├── setup.ts
│       ├── test-utils.tsx
│       └── mocks/
│           ├── handlers.ts       # MSW handlers
│           └── server.ts         # MSW server setup
├── e2e/
│   ├── fixtures/
│   │   ├── test.pdf
│   │   └── invalid.exe
│   ├── pages/
│   │   ├── documents-page.ts
│   │   └── search-page.ts
│   └── tests/
│       ├── upload-flow.spec.ts
│       ├── search-flow.spec.ts
│       └── error-handling.spec.ts
├── vitest.config.ts
└── playwright.config.ts
```

## Dependencies

### Add to `apps/frontend/package.json`:
```json
{
  "devDependencies": {
    "vitest": "^2.1.0",
    "@vitest/ui": "^2.1.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.0",
    "@testing-library/jest-dom": "^6.6.3",
    "jsdom": "^25.0.0",
    "msw": "^2.6.8",
    "@playwright/test": "^1.49.0",
    "@types/node": "^20.0.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

## Success Criteria

- [x] All phases completed
- [x] Coverage ≥70% (statements, branches, functions, lines)
- [x] <30s test suite runtime (unit + integration)
- [x] <2min E2E suite runtime
- [x] Zero flaky tests
- [x] CI pipeline green
- [x] Documentation updated (README test section)

## Notes

- **MSW advantage:** Same handlers work in dev mode (`npm run dev`) for API preview
- **TanStack Query testing:** Use `QueryClientProvider` wrapper, disable retries in tests
- **Playwright parallelization:** Runs tests across CPU cores (4x speedup)
- **Vitest watch mode:** Only reruns affected tests (smart dependency tracking)

## References

- Research: [Frontend Testing 2025](../reports/researcher-251220-frontend-testing-2025.md)
- Quick Ref: [Frontend Testing Quick Reference](../reports/frontend-testing-quick-ref.md)
- Backend Testing: [Testing Strategy](../../docs/core/testing-strategy.md)
- Phase 08 Implementation: [Frontend UI Plan](../2025-12-13-phase1-tdd-implementation/phase-08-frontend-ui.md)

## Timeline

**Total Estimated:** 18-26 hours (2-3 days focused work)

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| 1. Setup | 2-3h | Test environment ready |
| 2. Unit tests | 4-5h | 85%+ coverage on hooks/utils |
| 3. Integration | 6-8h | 80%+ coverage on components |
| 4. E2E | 4-5h | 5-8 critical flows |
| 5. CI/CD | 2-3h | Green pipeline |

**Next Steps After Completion:**
- Phase 09: Production Readiness (monitoring, logging, performance)
- Phase 10: Deployment & DevOps (Docker, CI/CD, infrastructure)
