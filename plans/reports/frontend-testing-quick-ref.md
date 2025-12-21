# Frontend Testing Quick Reference (2025)

**For React 18 + Vite 7 + TanStack Query v5**

## TL;DR - The Stack

```bash
# Install
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom msw @playwright/test

# Test commands
npm run test              # Watch unit/integration
npm run test:coverage     # Coverage report
npm run test:e2e          # E2E tests
```

## Tool Choices (Why?)

| Choice | Tool | Why |
|--------|------|-----|
| Unit/Integ | **Vitest** | 10-20x faster than Jest, native ES modules |
| Component | **React Testing Library** | User-focused, `renderHook` built-in |
| Query State | **TanStack Query v5** | Type-safe, `queryOptions` pattern |
| API Mock | **MSW** | Network-level, reusable across dev/test/Storybook |
| E2E | **Playwright** | 35-45% faster parallel, multi-browser, scalable |

## Testing Pyramid (for React + Query apps)

```
    E2E (10%)          Playwright, happy paths only
   Integ (30%)         API + React components + MSW
  Unit (60%)           Hooks, utilities, business logic
```

## Coverage Target: 70-80%

**Quality > Quantity.** Don't chase 100%.

| Area | Target |
|------|--------|
| Business logic | 85-90% |
| API integration | 80-90% |
| Hooks/utils | 75-85% |
| UI components | 60-70% |
| **Overall** | **70-80%** |

## Minimal Setup (30 minutes)

### 1. vitest.config.ts

```typescript
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
```

### 2. src/test/setup.ts

```typescript
import '@testing-library/jest-dom';
import { server } from '../mocks/server';
import { beforeAll, afterEach, afterAll } from 'vitest';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### 3. src/mocks/handlers.ts

```typescript
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/documents', () => {
    return HttpResponse.json([{ id: 1, name: 'Test' }]);
  }),
];
```

### 4. src/mocks/server.ts

```typescript
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### 5. src/test/test-utils.tsx

```typescript
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
```

## Component Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithQuery } from './test-utils';
import { DocumentList } from './DocumentList';

describe('DocumentList', () => {
  it('loads and displays documents', async () => {
    renderWithQuery(<DocumentList />);

    // MSW intercepts GET /api/documents
    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
  });

  it('handles user search', async () => {
    const user = userEvent.setup();
    renderWithQuery(<DocumentList />);

    await user.type(screen.getByPlaceholderText('Search...'), 'test');
    await user.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText('Results')).toBeInTheDocument();
    });
  });
});
```

## Hook Test Example

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDocuments } from './useDocuments';

describe('useDocuments', () => {
  it('fetches documents on mount', async () => {
    const { result } = renderHook(() => useDocuments());

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for data
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeDefined();
    });
  });
});
```

## Query Test with MSW

```typescript
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';

describe('Query with custom response', () => {
  it('handles API errors', async () => {
    // Override handler for this test
    server.use(
      http.get('/api/documents', () => {
        return HttpResponse.json(
          { error: 'Server error' },
          { status: 500 }
        );
      })
    );

    renderWithQuery(<DocumentList />);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
```

## Mutation Test Example

```typescript
it('creates document on submit', async () => {
  server.use(
    http.post('/api/documents', () => {
      return HttpResponse.json({ id: 1, name: 'New Doc' }, { status: 201 });
    })
  );

  const user = userEvent.setup();
  renderWithQuery(<CreateForm />);

  await user.type(screen.getByLabelText(/name/i), 'New Doc');
  await user.click(screen.getByRole('button', { name: /create/i }));

  await waitFor(() => {
    expect(screen.getByText(/success/i)).toBeInTheDocument();
  });
});
```

## E2E Test Example (Playwright)

```typescript
// e2e/upload.spec.ts
import { test, expect } from '@playwright/test';

test('upload and query document', async ({ page }) => {
  // Navigate
  await page.goto('/upload');

  // Upload file
  await page.locator('input[type="file"]').setInputFiles('test.pdf');

  // Wait for completion
  await page.waitForURL('/documents/*');

  // Verify uploaded
  expect(page.getByText(/uploaded/i)).toBeVisible();

  // Query the document
  await page.locator('input[placeholder="Search..."]').fill('test');
  await page.locator('button:has-text("Search")').click();

  // Verify results
  const results = page.locator('[data-testid="result"]');
  await expect(results).toHaveCount(5);
});
```

## playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

## npm Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

## Vitest Coverage Config

```typescript
// vitest.config.ts
test: {
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html'],
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80,
  },
}
```

## Directory Structure

```
src/
├── components/
│   ├── DocumentList.tsx
│   └── DocumentList.test.tsx         ← Component tests
├── hooks/
│   ├── useDocuments.ts
│   └── useDocuments.test.ts           ← Hook tests
├── test/
│   ├── setup.ts                       ← Global setup
│   └── test-utils.tsx                 ← Test helpers
└── mocks/
    ├── handlers.ts                    ← MSW handlers
    └── server.ts                      ← MSW server

e2e/
├── upload.spec.ts                     ← E2E tests
├── query.spec.ts
└── helpers/
    └── page-objects.ts                ← Page models
```

## Best Practices Checklist

- [ ] **Test behavior, not implementation** - Query by role, not className
- [ ] **Use userEvent, not fireEvent** - Realistic user interactions
- [ ] **Mock APIs with MSW, not fetch stubs** - Reusable, network-level
- [ ] **Test components, not hooks directly** - Unless reusable utility hook
- [ ] **Use queryOptions for type-safe queries** - TanStack Query v5 pattern
- [ ] **Wrap with QueryClientProvider** - Isolated test QueryClient
- [ ] **Reset MSW handlers afterEach** - No handler pollution between tests
- [ ] **Use waitFor, not arbitrary timeouts** - More reliable waits
- [ ] **Screenshot on failure (Playwright)** - Better debugging
- [ ] **Parallel E2E tests** - Playwright's native parallelization
- [ ] **Deterministic responses** - Same test data each run
- [ ] **Don't aim for 100% coverage** - 70-80% is realistic for frontend

## Migration from Jest

If migrating existing Jest tests:

1. Replace `jest.fn()` → `vi.fn()` (or use polyfill)
2. Replace `jest.mock()` → `vi.mock()`
3. Same assertions (Chai-compatible)
4. Same Test Library API
5. Run: `npm run test -- --run` to verify

Most tests work as-is with minimal changes.

## Key Vitest + Jest Differences

| Feature | Jest | Vitest |
|---------|------|--------|
| ESM Support | Experimental | Native |
| Watch speed | 100ms baseline | 5-10ms baseline |
| Config | Complex | Simple (uses Vite) |
| API compatibility | - | ~95% compatible |

## TanStack Query v5 Quick Patterns

```typescript
// Define query (type-safe, reusable)
export const documentsQuery = queryOptions({
  queryKey: ['documents'],
  queryFn: () => fetchDocuments(),
});

// In component
export function DocumentList() {
  const { data } = useSuspenseQuery(documentsQuery);
  return data.map(d => <div key={d.id}>{d.name}</div>);
}

// In tests (type-safe cache mutation)
queryClient.setQueryData(documentsQuery.queryKey, mockDocs);
```

## Common Pitfalls & Fixes

### ❌ Testing implementation details
```typescript
// Bad
expect(component.state.isLoading).toBe(false);

// Good
expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
```

### ❌ Not waiting for async
```typescript
// Bad
render(<Component />);
expect(screen.getByText('Data')).toBeInTheDocument(); // May fail!

// Good
await waitFor(() => {
  expect(screen.getByText('Data')).toBeInTheDocument();
});
```

### ❌ Not resetting Query cache
```typescript
// Bad - cache carries over between tests
const client = new QueryClient();

// Good - create fresh client each test
function createTestQueryClient() {
  return new QueryClient({ ... });
}
```

### ❌ Forgetting MSW reset
```typescript
// Bad - handlers carry over
beforeEach(() => { /* ... */ });

// Good
afterEach(() => server.resetHandlers());
```

---

**Need full details?** See `/home/namtroi/RAGBase/plans/reports/researcher-251220-frontend-testing-2025.md`

**Ready to implement?** Reference this guide for 80% of common patterns.
