# Frontend Testing Best Practices for React 18 + Vite 7 + TanStack Query v5 (2025)

**Date:** December 20, 2025
**Status:** Research Complete
**Focus:** Modern testing stack for Vite-based React applications

---

## Executive Summary

For React 18 + Vite 7 + TanStack Query v5 projects in 2025, the optimal testing stack is:

- **Unit/Integration:** Vitest (10-20x faster than Jest, native ES modules, TypeScript support)
- **Component Testing:** React Testing Library (renderHook built-in, focus on user behavior)
- **API Mocking:** Mock Service Worker (MSW) - network-level interception, cross-environment reusable
- **E2E Testing:** Playwright (35-45% faster parallel execution, multi-browser, modern architecture)
- **Coverage Target:** 70-80% realistic for frontend (quality > quantity)

This stack emphasizes speed, modern tooling, and practical testability without unnecessary overhead.

---

## 1. Test Runner: Vitest vs Jest

### Recommendation: **VITEST** for Vite-based projects

#### Performance Benchmarks (2025)

| Metric | Vitest | Jest |
|--------|--------|------|
| Cold run | 4x faster | Baseline |
| Watch mode | 10-20x faster | Baseline |
| Memory usage | 800 MB peak | 1.2 GB peak (50K LOC) |
| Test runtime reduction | 30-70% | N/A |

#### Key Advantages

**ES Module Support:** Native, out-of-the-box (Jest: experimental only)
- No Babel transpilation overhead
- Aligns with modern JavaScript ecosystem

**TypeScript & JSX:** Built-in support without configuration
- Eliminates need for preset configuration files
- Uses same build tools as Vite (esbuild/SWC)

**Plugin System:** Leverages Vite ecosystem
- Shares Vite plugins (React, Vue, etc.)
- Configuration parity with dev environment

**Developer Experience:** Faster feedback loop
- Watch mode rebuilds in milliseconds
- Inline snapshot preview
- Smart test re-runs

#### Migration Path

Vitest is mostly Jest-compatible. Most Jest tests migrate with zero or minimal changes:
- Replace `jest.fn()` with `vi.fn()` (optional polyfill available)
- Replace `jest.mock()` with `vi.mock()`
- Same assertion syntax (Chai/Vitest compatible)

#### When to Choose Jest

Only for React Native / Expo projects (mandatory). For web, Vitest dominates.

---

## 2. Component Testing: React Testing Library Patterns

### Philosophy: User-Centric Testing

Test what users see and interact with, not implementation details.

### Setup for Vitest + React 18

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'src/test/'],
    },
  },
});
```

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});
```

### Hook Testing Pattern (2025 Best Practice)

**Integrated renderHook in React Testing Library v13.1+**

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCounter } from './useCounter';

describe('useCounter', () => {
  it('increments counter', async () => {
    const { result } = renderHook(() => useCounter());

    expect(result.current.count).toBe(0);

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });

  it('handles async updates', async () => {
    const { result } = renderHook(() => useAsyncData());

    expect(result.current.data).toBeNull();

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
  });
});
```

### Component Testing Pattern

**Test component behavior via rendering, not hook internals**

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('displays content after data loads', async () => {
    render(<MyComponent />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/content/i)).toBeInTheDocument();
    });
  });

  it('handles user interactions', async () => {
    const user = userEvent.setup();
    render(<MyComponent />);

    const button = screen.getByRole('button', { name: /click me/i });
    await user.click(button);

    expect(screen.getByText(/clicked/i)).toBeInTheDocument();
  });
});
```

### Best Practices

1. **Query Priority** (descending)
   - `getByRole()` - semantic, accessible
   - `getByLabelText()` - form fields
   - `getByPlaceholderText()` - last resort
   - Never use `querySelector()` or `className` selectors

2. **Async Handling**
   - Use `waitFor()` for state updates
   - Use `userEvent` instead of `fireEvent` (realistic user interactions)
   - `waitFor(() => expect(...))` not `waitFor(async () => { })`

3. **Edge Cases**
   - Empty states
   - Loading states
   - Error states
   - Disabled states
   - Accessibility attributes

---

## 3. React Query (TanStack Query v5) Testing

### Test Setup: Custom QueryClient

```typescript
// src/test/test-utils.tsx
import { ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity, // Prevent garbage collection during tests
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function Wrapper({ children }: { children: ReactNode }) {
  const testQueryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={testQueryClient}>
      {children}
    </QueryClientProvider>
  );
}

export function renderWithQueryClient(
  ui: ReactNode,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: Wrapper, ...options });
}
```

### useQuery Testing Pattern

```typescript
// Strategy 1: Mock network with MSW (recommended)
import { server } from './mocks/server';
import { http, HttpResponse } from 'msw';

describe('useQuery with MSW', () => {
  it('fetches and displays data', async () => {
    server.use(
      http.get('/api/users', () => {
        return HttpResponse.json({ users: [{ id: 1, name: 'John' }] });
      })
    );

    const { screen } = renderWithQueryClient(<UserList />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });
  });

  it('handles errors', async () => {
    server.use(
      http.get('/api/users', () => {
        return HttpResponse.error();
      })
    );

    renderWithQueryClient(<UserList />);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});

// Strategy 2: Mock hook directly (integration tests)
import { vi } from 'vitest';
import { useQuery } from '@tanstack/react-query';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

describe('useQuery mocked directly', () => {
  it('uses mocked query data', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: { users: [{ id: 1, name: 'John' }] },
      isLoading: false,
      isError: false,
      status: 'success',
    } as any);

    render(<UserList />);
    expect(screen.getByText('John')).toBeInTheDocument();
  });
});
```

### useMutation Testing Pattern

```typescript
describe('useMutation', () => {
  it('calls mutation on user action', async () => {
    server.use(
      http.post('/api/users', () => {
        return HttpResponse.json({ id: 1, name: 'New User' });
      })
    );

    const user = userEvent.setup();
    renderWithQueryClient(<CreateUserForm />);

    await user.type(screen.getByLabelText(/name/i), 'New User');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument();
    });
  });

  it('handles mutation loading state', async () => {
    let resolveRequest: any;
    server.use(
      http.post('/api/users', async () => {
        await new Promise(resolve => {
          resolveRequest = resolve;
        });
        return HttpResponse.json({ id: 1 });
      })
    );

    const user = userEvent.setup();
    renderWithQueryClient(<CreateUserForm />);

    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(screen.getByRole('button')).toBeDisabled();

    resolveRequest();

    await waitFor(() => {
      expect(screen.getByRole('button')).not.toBeDisabled();
    });
  });

  it('handles mutation errors', async () => {
    server.use(
      http.post('/api/users', () => {
        return HttpResponse.json(
          { error: 'User already exists' },
          { status: 400 }
        );
      })
    );

    const user = userEvent.setup();
    renderWithQueryClient(<CreateUserForm />);

    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    });
  });
});
```

### v5 Specific Feature: queryOptions

**Recommended pattern for type-safe reusable queries**

```typescript
// src/queries/users.ts
import { queryOptions } from '@tanstack/react-query';
import { fetchUsers } from './api';

export const usersQueryOptions = queryOptions({
  queryKey: ['users'],
  queryFn: () => fetchUsers(),
});

// In components
import { useSuspenseQuery } from '@tanstack/react-query';

export function UserList() {
  const { data } = useSuspenseQuery(usersQueryOptions);
  return <div>{data.map(u => u.name)}</div>;
}

// In tests (type-safe cache access)
import { queryClient } from './test-utils';

queryClient.setQueryData(usersQueryOptions.queryKey, mockUsers);
```

---

## 4. API Mocking: Mock Service Worker (MSW)

### Why MSW > Other Approaches

| Approach | Scope | Reusability | Complexity |
|----------|-------|-------------|-----------|
| MSW | Network level | Dev + Test + Storybook | Low |
| Fetch stubbing | Fetch only | Test only | Medium |
| Axios interceptors | Client only | Test only | High |
| HTTP mock lib | Manual | Test only | High |

### Setup for React + Vite

```bash
npm install -D msw
npx msw init public/
```

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Users API
  http.get('/api/users', () => {
    return HttpResponse.json([
      { id: 1, name: 'John', email: 'john@example.com' },
      { id: 2, name: 'Jane', email: 'jane@example.com' },
    ]);
  }),

  // Create user
  http.post('/api/users', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { id: Date.now(), ...body },
      { status: 201 }
    );
  }),

  // Get single user
  http.get('/api/users/:id', ({ params }) => {
    return HttpResponse.json({ id: params.id, name: 'John' });
  }),

  // Error example
  http.get('/api/error', () => {
    return HttpResponse.error();
  }),
];
```

```typescript
// src/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// Setup in test file or global setup
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Cross-Environment Reusability

Same handlers work in:
1. **Local development** - Browser + vite dev server
2. **Unit/Integration tests** - Via msw/node
3. **E2E tests** - Via msw/browser
4. **Storybook** - Via MSW addon

This is the single source of truth for API behavior.

### Best Practices

1. **Organize handlers by feature**
   ```
   src/mocks/
   ├── handlers.ts          # Combined export
   ├── handlers/
   │   ├── users.ts
   │   ├── documents.ts
   │   └── queries.ts
   └── server.ts
   ```

2. **Handler composition**
   ```typescript
   import { usersHandlers } from './handlers/users';
   import { documentsHandlers } from './handlers/documents';

   export const handlers = [
     ...usersHandlers,
     ...documentsHandlers,
   ];
   ```

3. **Test-specific overrides**
   ```typescript
   it('handles specific error', () => {
     server.use(
       http.get('/api/users', () => {
         return HttpResponse.json({ error: 'Not found' }, { status: 404 });
       })
     );

     // Test code
   });
   ```

4. **Deterministic responses**
   - Use fixed test data, not randomized values
   - Ensure seed-based responses for reproducibility
   - Mock timestamps consistently

---

## 5. E2E Testing: Playwright vs Cypress

### Recommendation: **PLAYWRIGHT** for React + Vite projects

#### Comparative Analysis

| Criteria | Playwright | Cypress |
|----------|-----------|---------|
| **Browser Support** | Chrome, Firefox, Safari, Edge + mobile | Chrome, Firefox, Edge (no Safari) |
| **Parallel Execution** | Native, free, 35-45% faster | Requires Dashboard or third-party tools |
| **Language Support** | Python, Java, C#, JS | JavaScript only |
| **Architecture** | Out-of-process (DevTools Protocol) | In-browser |
| **Multi-tab/window** | Full support | Limited |
| **Mobile Testing** | iOS, Android via browser contexts | No native support |
| **Setup Complexity** | Medium | Low |
| **DX (Developer Experience)** | Powerful, less visual feedback | Visual, interactive GUI |

#### Performance Metrics (2025)

**Parallel Execution:**
- Playwright: 35-45% faster for mixed browser suites (native free parallelization)
- Cypress: Serial by default (Dashboard required for free parallelization)

**CI/CD Efficiency:**
- Playwright: Optimal for large test suites, distributed execution
- Cypress: Better for quick feedback in dev, single-browser testing

#### When to Choose Each

**Playwright (Recommended for RAGBase):**
- Need multi-browser/mobile coverage
- Complex workflows (multiple tabs, contexts)
- Enterprise-scale test suites
- Parallel execution essential
- Team uses non-JS languages

**Cypress:**
- Small, focused React component tests
- Need interactive debugging in real-time
- Team prefers JavaScript-only
- Quick feedback over comprehensive coverage
- Chrome/Firefox only sufficient

### Playwright Setup for React + Vite

```bash
npm install -D @playwright/test
npx playwright install
```

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
```

```typescript
// e2e/example.spec.ts
import { test, expect } from '@playwright/test';

test('document upload workflow', async ({ page }) => {
  // Navigate
  await page.goto('/upload');

  // Upload file
  await page.locator('input[type="file"]').setInputFiles('test.pdf');

  // Check processing state
  expect(page.getByText(/processing/i)).toBeVisible();

  // Wait for completion
  await page.waitForURL('/documents/*');

  // Verify result
  expect(page.getByText(/upload complete/i)).toBeVisible();
});

test.describe('Query functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Setup: create test document
  });

  test('returns similar results', async ({ page }) => {
    await page.locator('input[placeholder="Search..."]').fill('test query');
    await page.locator('button:has-text("Search")').click();

    const results = page.locator('[data-testid="result"]');
    await expect(results).toHaveCount(5);
  });
});
```

### Playwright Best Practices

1. **Use Page Object Model for complex flows**
   ```typescript
   class DocumentPage {
     constructor(private page: Page) {}

     async uploadFile(path: string) {
       await this.page.locator('input[type="file"]').setInputFiles(path);
     }

     async waitForProcessing() {
       await this.page.waitForURL('/documents/*');
     }
   }
   ```

2. **Leverage MSW for consistent test data**
   - MSW handlers run in browser context for Playwright too
   - Same handlers as unit tests
   - Deterministic responses

3. **Test critical user journeys**
   - Upload → Processing → Query → Results
   - Error handling paths
   - Edge cases (large files, network failures)

4. **Performance considerations**
   - Parallel workers default to CPU count
   - Set `workers: 1` for CI stability
   - Use `reuseExistingServer` in dev

---

## 6. Frontend Testing Pyramid & Coverage Standards

### Recommended Test Distribution for React + Query Apps

```
          E2E (10%)
        ┌─────────┐
        │ 5-10    │  Happy paths, critical workflows
        │ tests   │  Playwright, cross-browser
        ├─────────┤
        │ Integ   │  Query integration, API mocking
      ┌─┤ 20-30   │  API endpoints + React components
      │ │ tests   │  MSW + React Testing Library
      │ ├─────────┤
      │ │ Unit    │  Hooks, utils, business logic
      └─┤ 60-70   │  Pure functions, edge cases
        │ tests   │  Vitest, renderHook
        └─────────┘
```

### Realistic Coverage Targets for Frontend

| Category | Target | Rationale |
|----------|--------|-----------|
| **Overall** | 70-80% | Industry standard, quality over quantity |
| **Business Logic** | 85-90% | Critical, testable |
| **UI Components** | 60-70% | Many variations hard to test exhaustively |
| **Hooks/Utilities** | 75-85% | High testability |
| **API Integration** | 80-90% | Mock-friendly, important |

### What NOT to Count in Coverage

- UI framework boilerplate (conditional renders, refs)
- Third-party library wrapper calls
- 100% branch coverage (diminishing returns past 80%)
- Tests written just to hit a number

### Enforce in CI

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.spec.ts',
        '**/*.test.ts',
      ],
    },
  },
});
```

```bash
# Run with coverage enforcement
npm run test:coverage

# CI will fail if thresholds not met
```

### Quality Metrics Beyond Coverage

1. **Test isolation** - No shared state between tests
2. **Meaningful assertions** - Test behavior, not implementation
3. **Edge case coverage** - Error states, boundary conditions
4. **Performance** - Tests run in < 5 seconds (unit), < 30s (integration)
5. **Maintainability** - Tests easy to read, update, extend

---

## 7. Testing Setup Checklist for RAGBase Frontend (Phase 08)

### Dependencies to Install

```bash
# Testing framework & libraries
npm install -D vitest @vitest/ui jsdom
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D @tanstack/react-query

# API mocking
npm install -D msw

# E2E testing
npm install -D @playwright/test

# Coverage
npm install -D @vitest/coverage-v8
```

### Configuration Files

- [ ] `vitest.config.ts` - Unit/integration test runner
- [ ] `vitest.e2e.config.ts` - E2E configuration (separate from unit)
- [ ] `playwright.config.ts` - E2E test configuration
- [ ] `src/test/setup.ts` - Global test utilities
- [ ] `src/test/test-utils.tsx` - React Testing Library + Query helpers
- [ ] `src/mocks/handlers.ts` - MSW request handlers
- [ ] `src/mocks/server.ts` - MSW server setup
- [ ] `public/mockServiceWorker.js` - MSW worker script

### Directory Structure

```
src/
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx
├── hooks/
│   ├── useQuery.ts
│   └── useQuery.test.ts
├── test/
│   ├── setup.ts
│   ├── test-utils.tsx
│   └── fixtures/         # Test data
└── mocks/
    ├── handlers.ts
    └── server.ts

e2e/
├── example.spec.ts
└── pages/                # Page objects

tests/
├── integration/
│   ├── api.test.ts
│   └── query.test.ts
```

### npm Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

---

## 8. Integration Pattern: Vite + Vitest + React Query + MSW

Complete minimal example:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});

// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
});

// src/test/setup.ts
import '@testing-library/jest-dom';
import { server } from '../mocks/server';
import { beforeAll, afterEach, afterAll } from 'vitest';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// src/test/test-utils.tsx
import { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });

export function renderWithQuery(ui: ReactNode) {
  const testQueryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={testQueryClient}>
      {ui}
    </QueryClientProvider>
  );
}

// Example test
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithQuery } from './test-utils';
import { UserList } from '../components/UserList';

describe('UserList', () => {
  it('displays users from API', async () => {
    renderWithQuery(<UserList />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });
  });
});
```

---

## 9. Technology Stack Summary

### Recommended for RAGBase Phase 08 (Frontend)

| Layer | Tool | Rationale |
|-------|------|-----------|
| **Test Runner** | Vitest | 10-20x faster, native ESM, Vite parity |
| **Component Test** | React Testing Library + renderHook | User-focused, integrated hooks API |
| **State Query** | @tanstack/react-query | Optimized for data fetching, built-in caching |
| **API Mock** | MSW | Network-level, cross-environment reusable |
| **Unit/Integ** | Vitest + jsdom | Same runner, fast, practical |
| **E2E** | Playwright | Parallel, multi-browser, enterprise-ready |
| **Coverage** | @vitest/coverage-v8 | Native Vitest integration, accurate reporting |

### Technology Versions (2025)

- React 18.x (stable, hooks mature)
- Vite 7.0+ (latest, fast)
- Vitest 3.2+ (Vite 7 compatible)
- TanStack Query v5.90+ (latest stable)
- Playwright 1.48+ (latest)
- Testing Library latest (integrated renderHook)

---

## 10. Coverage Standards Applied to RAGBase

For RAGBase Frontend (Phase 08) specifically:

| Component | Target | Notes |
|-----------|--------|-------|
| Document upload form | 75% | User interactions, validation |
| Query search interface | 75% | Form inputs, result display |
| useQuery hooks | 85% | Loading, error, success states |
| useMutation hooks | 85% | Mutation lifecycle, error handling |
| API integration | 85% | MSW intercepted requests |
| Utilities | 70% | Helper functions |
| **Overall** | **80%** | Enterprise-standard frontend |

**Not aiming for 100%:** Time better spent on edge cases, error states, and user workflows.

---

## Summary: Tool Recommendations & Rationale

### Primary Stack (Recommended)

```
┌─────────────────────────────────────────┐
│ Vitest (Unit/Integration Tests)         │
│ └─ React Testing Library + renderHook   │
│ └─ @tanstack/react-query (Query client) │
│ └─ Mock Service Worker (API mocking)    │
├─────────────────────────────────────────┤
│ Playwright (E2E Tests)                  │
│ └─ Multi-browser, parallel, fast        │
└─────────────────────────────────────────┘
```

### Why This Stack

1. **Speed:** Vitest 10-20x faster than Jest for watch mode
2. **Modern:** Native ES modules, TypeScript, JSX out-of-the-box
3. **DX:** Vite integration = predictable, zero mystery config
4. **Reusable:** MSW handlers work in dev, tests, Storybook, E2E
5. **Scalable:** Playwright's parallel execution for large suites
6. **Practical:** 70-80% coverage target is realistic, quality-focused

### Avoid

- ❌ Jest (slower, legacy ESM support)
- ❌ Cypress (single-browser, serial tests, expensive scaling)
- ❌ HTTP client stubs (client-specific, not reusable)
- ❌ Chasing 100% coverage (diminishing returns past 80%)

---

## Implementation Priority for Phase 08

1. **Week 1-2:** Vitest setup, basic component tests (60-70 tests)
2. **Week 2-3:** React Query integration tests with MSW (30-40 tests)
3. **Week 3-4:** E2E tests with Playwright (8-12 critical paths)
4. **Week 4:** Coverage reporting, CI/CD integration

Expected outcome: 80% coverage, < 30 second test suite, green CI pipeline.

---

## Unresolved Questions

1. **Frontend framework choice:** Will Phase 08 use vanilla React, or consider Next.js/Remix for SSR/routing?
2. **Component library:** Any specific UI library (shadcn/ui, MUI, etc.) that may need test consideration?
3. **Auth testing:** How will authentication/authorization be tested? JWT mocking? Session management?
4. **Visual regression testing:** Need for Percy/Playwright visual comparisons, or defer to manual QA?

---

## Sources

### Test Runners
- [Jest vs Vitest: Which Test Runner Should You Use in 2025? | Medium](https://medium.com/@ruverd/jest-vs-vitest-which-test-runner-should-you-use-in-2025-5c85e4f2bda9)
- [Vitest vs Jest | Better Stack Community](https://betterstack.com/community/guides/scaling-nodejs/vitest-vs-jest/)
- [Jest vs Vitest in a React Project: Which One Should You Use in 2025?](https://javascript.plainenglish.io/jest-vs-vitest-in-a-react-project-which-one-should-you-use-in-2025-2c254ddfd6f8)

### React Testing Library
- [Complete Guide to React Hooks Testing | Toptal](https://www.toptal.com/react/testing-react-hooks-tutorial)
- [Testing React Hooks: Best Practices with Examples | Medium](https://medium.com/@ignatovich.dm/testing-react-hooks-best-practices-with-examples-d3fb5246aa09)

### TanStack Query
- [TanStack Query v5 React Docs](https://tanstack.com/query/v5/docs/framework/react/overview)
- [From Beginner to Pro: Mastering State Management with TanStack Query v5](https://dev.to/rajat128/from-beginner-to-pro-mastering-state-management-with-tanstack-query-v5-3hp6)

### Mock Service Worker
- [Mock Service Worker Documentation](https://mswjs.io/)
- [A Comprehensive Guide to Mock Service Worker (MSW)](https://www.callstack.com/blog/guide-to-mock-service-worker-msw/)
- [Mock Service Worker (MSW) in Next.js – A Guide for API Mocking and Testing](https://dev.to/mehakb7/mock-service-worker-msw-in-nextjs-a-guide-for-api-mocking-and-testing-e9m)

### E2E Testing
- [Playwright vs. Cypress: The Ultimate 2025 E2E Testing Showdown](https://www.frugaltesting.com/blog/playwright-vs-cypress-the-ultimate-2025-e2e-testing-showdown/)
- [Cypress vs Playwright: A Comparison | BrowserStack](https://www.browserstack.com/guide/playwright-vs-cypress)
- [Playwright vs Cypress: The Essential 2025 Comparison for Developers](https://devin-rosario.medium.com/cypress-vs-playwright-the-essential-2025-comparison-for-developers-d2e40f20f450)

### Coverage Standards
- [Code Coverage Best Practices | Google Testing Blog](https://testing.googleblog.com/2020/08/code-coverage-best-practices/)
- [Test Coverage | Martin Fowler](https://martinfowler.com/bliki/TestCoverage.html)
- [Code Coverage Best Practices](https://www.graphite.com/guides/code-coverage-best-practices)

### Setup & Configuration
- [React Testing Setup: Vitest + TypeScript + React Testing Library](https://dev.to/kevinccbsg/react-testing-setup-vitest-typescript-react-testing-library-42c8)
- [Testing React Applications with Vitest: A Comprehensive Guide](https://dev.to/samuel_kinuthia/testing-react-applications-with-vitest-a-comprehensive-guide-2jm8)
- [Vitest + React Testing Library for Remix & React Router v7](https://dev.to/web-sujal/vitest-react-testing-library-for-remix-react-router-v7-with-typescript-a-complete-setup-guide-4pop)

---

**Report Generated:** 2025-12-20
**Status:** Complete & Ready for Implementation
**Next Steps:** Share findings with team, establish Phase 08 testing standards, begin setup
