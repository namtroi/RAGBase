# Phase 01: Test Infrastructure Setup

**Parent:** [plan.md](./plan.md) | **Status:** ⏳ Pending | **Priority:** P1

## Objective

Configure Vitest, React Testing Library, MSW foundation for frontend testing.

## Tasks

### 1.1 Install Dependencies
```bash
cd apps/frontend
pnpm add -D vitest @vitest/ui @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom msw
```

### 1.2 Create Vitest Config
**File:** `apps/frontend/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()] as any,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    css: true,
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
        'src/main.tsx',
      ],
    },
  },
});
```

### 1.3 Create Test Setup
**File:** `apps/frontend/src/test/setup.ts`

```typescript
import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia (for responsive tests)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;
```

### 1.4 Create Test Utilities
**File:** `apps/frontend/src/test/test-utils.tsx`

```typescript
import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create QueryClient with disabled retries for tests
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// Test wrapper with QueryClient
interface AllTheProvidersProps {
  children: React.ReactNode;
}

export function AllTheProviders({ children }: AllTheProvidersProps) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// Custom render with providers
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllTheProviders, ...options });
}

// Re-export everything from RTL
export * from '@testing-library/react';
export { renderWithProviders as render };
```

### 1.5 Setup MSW Handlers
**File:** `apps/frontend/src/test/mocks/handlers.ts`

```typescript
import { http, HttpResponse } from 'msw';

const API_BASE = 'http://localhost:5173/api';

export const handlers = [
  // GET /api/documents
  http.get(`${API_BASE}/documents`, () => {
    return HttpResponse.json([
      {
        id: 'doc-1',
        filename: 'test.pdf',
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
        chunkCount: 15,
      },
      {
        id: 'doc-2',
        filename: 'processing.pdf',
        status: 'PROCESSING',
        createdAt: new Date().toISOString(),
      },
    ]);
  }),

  // GET /api/documents/:id
  http.get(`${API_BASE}/documents/:id`, ({ params }) => {
    const { id } = params;
    return HttpResponse.json({
      id,
      filename: 'test.pdf',
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      chunkCount: 15,
    });
  }),

  // POST /api/documents
  http.post(`${API_BASE}/documents`, async () => {
    return HttpResponse.json(
      {
        documentId: 'new-doc-id',
        message: 'Document uploaded successfully',
      },
      { status: 201 }
    );
  }),

  // POST /api/query
  http.post(`${API_BASE}/query`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      results: [
        {
          chunkId: 'chunk-1',
          text: 'Machine learning is a subset of AI...',
          score: 0.95,
          documentId: 'doc-1',
          filename: 'test.pdf',
        },
        {
          chunkId: 'chunk-2',
          text: 'Neural networks are fundamental...',
          score: 0.87,
          documentId: 'doc-1',
          filename: 'test.pdf',
        },
      ],
    });
  }),
];
```

**File:** `apps/frontend/src/test/mocks/server.ts`

```typescript
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// Setup server lifecycle
export function setupMswServer() {
  beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}
```

### 1.6 Update package.json Scripts
**File:** `apps/frontend/package.json`

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

### 1.7 Create Smoke Test
**File:** `apps/frontend/src/test/smoke.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from './test-utils';

// Simple smoke test
describe('Test Infrastructure', () => {
  it('renders text correctly', () => {
    render(<div>Hello Test</div>);
    expect(screen.getByText('Hello Test')).toBeInTheDocument();
  });

  it('has working assertions', () => {
    expect(1 + 1).toBe(2);
  });
});
```

### 1.8 Verify Setup
```bash
# Run smoke test
pnpm --filter @ragbase/frontend test

# Expected output:
# ✓ src/test/smoke.test.tsx (2)
#   ✓ Test Infrastructure (2)
#     ✓ renders text correctly
#     ✓ has working assertions
# Test Files  1 passed (1)
# Tests  2 passed (2)
```

## Acceptance Criteria

- [x] Vitest config created with coverage thresholds
- [x] Test setup file configures jsdom, mocks
- [x] Test utilities provide QueryClient wrapper
- [x] MSW handlers mock all backend endpoints
- [x] npm scripts added (test, test:watch, test:ui, test:coverage)
- [x] Smoke test passes
- [x] `pnpm test` runs successfully

## Files Created

```
apps/frontend/
├── vitest.config.ts
├── src/
│   └── test/
│       ├── setup.ts
│       ├── test-utils.tsx
│       ├── smoke.test.tsx
│       └── mocks/
│           ├── handlers.ts
│           └── server.ts
└── package.json (updated)
```

## Notes

- **MSW v2 syntax:** Uses `http` instead of `rest`, `HttpResponse` instead of `res()`
- **QueryClient:** Disable retries/cache in tests to avoid flaky behavior
- **Globals:** `expect`, `describe`, `it` available without imports (vitest `globals: true`)
- **Coverage thresholds:** 70% enforced by default, can adjust per-file if needed

## Next Phase

→ [Phase 02: Unit Tests - Hooks & Utilities](./phase-02-unit-tests.md)
