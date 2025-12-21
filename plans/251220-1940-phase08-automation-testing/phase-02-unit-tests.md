# Phase 02: Unit Tests - Hooks & Utilities

**Parent:** [plan.md](./plan.md) | **Status:** ⏳ Pending | **Priority:** P1

## Objective

Test custom hooks (`useDocuments`, `useQuery`) and API client utilities. Target 85%+ coverage on business logic.

## Tasks

### 2.1 API Client Tests

**File:** `apps/frontend/src/api/__tests__/client.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupMswServer } from '@/test/mocks/server';
import { apiRequest } from '../client';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';

setupMswServer();

describe('apiRequest', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sends API key from localStorage', async () => {
    localStorage.setItem('apiKey', 'test-key-123');

    let capturedHeaders: Headers | undefined;
    server.use(
      http.get('http://localhost:5173/api/test', ({ request }) => {
        capturedHeaders = request.headers;
        return HttpResponse.json({ success: true });
      })
    );

    await apiRequest('/test');

    expect(capturedHeaders?.get('X-API-Key')).toBe('test-key-123');
  });

  it('throws error when API key missing', async () => {
    await expect(apiRequest('/test')).rejects.toThrow('API key not found');
  });

  it('parses JSON response correctly', async () => {
    localStorage.setItem('apiKey', 'test-key');

    server.use(
      http.get('http://localhost:5173/api/data', () => {
        return HttpResponse.json({ message: 'success', count: 42 });
      })
    );

    const result = await apiRequest('/data');
    expect(result).toEqual({ message: 'success', count: 42 });
  });

  it('throws on non-ok response', async () => {
    localStorage.setItem('apiKey', 'test-key');

    server.use(
      http.get('http://localhost:5173/api/error', () => {
        return new HttpResponse(null, {
          status: 400,
          statusText: 'Bad Request',
        });
      })
    );

    await expect(apiRequest('/error')).rejects.toThrow('HTTP error! status: 400');
  });

  it('handles network errors', async () => {
    localStorage.setItem('apiKey', 'test-key');

    server.use(
      http.get('http://localhost:5173/api/timeout', () => {
        return HttpResponse.error();
      })
    );

    await expect(apiRequest('/timeout')).rejects.toThrow();
  });
});
```

### 2.2 useDocuments Hook Tests

**File:** `apps/frontend/src/hooks/__tests__/use-documents.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { setupMswServer } from '@/test/mocks/server';
import { AllTheProviders } from '@/test/test-utils';
import { useDocuments, useDocument, useUploadDocument } from '../use-documents';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';

setupMswServer();

describe('useDocuments', () => {
  beforeEach(() => {
    localStorage.setItem('apiKey', 'test-key');
  });

  it('fetches documents list', async () => {
    const { result } = renderHook(() => useDocuments(), {
      wrapper: AllTheProviders,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].filename).toBe('test.pdf');
  });

  it('handles fetch error', async () => {
    server.use(
      http.get('http://localhost:5173/api/documents', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    const { result } = renderHook(() => useDocuments(), {
      wrapper: AllTheProviders,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it('polls when documents are processing', async () => {
    // Initial: PROCESSING
    let pollCount = 0;
    server.use(
      http.get('http://localhost:5173/api/documents', () => {
        pollCount++;
        const status = pollCount < 3 ? 'PROCESSING' : 'COMPLETED';
        return HttpResponse.json([
          {
            id: 'doc-1',
            filename: 'test.pdf',
            status,
            createdAt: new Date().toISOString(),
          },
        ]);
      })
    );

    const { result } = renderHook(() => useDocuments(), {
      wrapper: AllTheProviders,
    });

    // Should poll multiple times
    await waitFor(
      () => {
        expect(pollCount).toBeGreaterThan(2);
      },
      { timeout: 10000 }
    );

    expect(result.current.data?.[0].status).toBe('COMPLETED');
  });
});

describe('useDocument', () => {
  beforeEach(() => {
    localStorage.setItem('apiKey', 'test-key');
  });

  it('fetches single document', async () => {
    const { result } = renderHook(() => useDocument('doc-1'), {
      wrapper: AllTheProviders,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.id).toBe('doc-1');
    expect(result.current.data?.filename).toBe('test.pdf');
  });

  it('returns undefined for empty id', () => {
    const { result } = renderHook(() => useDocument(''), {
      wrapper: AllTheProviders,
    });

    expect(result.current.data).toBeUndefined();
  });
});

describe('useUploadDocument', () => {
  beforeEach(() => {
    localStorage.setItem('apiKey', 'test-key');
  });

  it('uploads file successfully', async () => {
    const { result } = renderHook(() => useUploadDocument(), {
      wrapper: AllTheProviders,
    });

    const file = new File(['test content'], 'test.pdf', {
      type: 'application/pdf',
    });

    result.current.mutate({ file, ocrMode: 'auto' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.documentId).toBe('new-doc-id');
  });

  it('handles upload error', async () => {
    server.use(
      http.post('http://localhost:5173/api/documents', () => {
        return new HttpResponse(null, { status: 400 });
      })
    );

    const { result } = renderHook(() => useUploadDocument(), {
      wrapper: AllTheProviders,
    });

    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

    result.current.mutate({ file, ocrMode: 'auto' });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
```

### 2.3 useQuery Hook Tests

**File:** `apps/frontend/src/hooks/__tests__/use-query.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { setupMswServer } from '@/test/mocks/server';
import { AllTheProviders } from '@/test/test-utils';
import { useSearch } from '../use-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';

setupMswServer();

describe('useSearch', () => {
  beforeEach(() => {
    localStorage.setItem('apiKey', 'test-key');
  });

  it('executes search query', async () => {
    const { result } = renderHook(() => useSearch(), {
      wrapper: AllTheProviders,
    });

    result.current.mutate({
      query: 'machine learning',
      topK: 5,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.results).toHaveLength(2);
    expect(result.current.data?.results[0].score).toBe(0.95);
  });

  it('respects topK parameter', async () => {
    server.use(
      http.post('http://localhost:5173/api/query', async ({ request }) => {
        const body = (await request.json()) as any;
        expect(body.topK).toBe(10);

        return HttpResponse.json({
          results: Array(10).fill({
            chunkId: 'chunk-x',
            text: 'sample',
            score: 0.8,
            documentId: 'doc-1',
            filename: 'test.pdf',
          }),
        });
      })
    );

    const { result } = renderHook(() => useSearch(), {
      wrapper: AllTheProviders,
    });

    result.current.mutate({
      query: 'test',
      topK: 10,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('handles empty results', async () => {
    server.use(
      http.post('http://localhost:5173/api/query', () => {
        return HttpResponse.json({ results: [] });
      })
    );

    const { result } = renderHook(() => useSearch(), {
      wrapper: AllTheProviders,
    });

    result.current.mutate({ query: 'nonexistent', topK: 5 });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.results).toHaveLength(0);
  });

  it('handles search error', async () => {
    server.use(
      http.post('http://localhost:5173/api/query', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    const { result } = renderHook(() => useSearch(), {
      wrapper: AllTheProviders,
    });

    result.current.mutate({ query: 'test', topK: 5 });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
```

## Acceptance Criteria

- [x] API client tests cover: auth header, error handling, JSON parsing
- [x] `useDocuments` tests: fetch, error, polling behavior
- [x] `useDocument` tests: fetch single, empty id handling
- [x] `useUploadDocument` tests: success, error states
- [x] `useSearch` tests: query execution, topK, empty results, errors
- [x] All tests pass: `pnpm --filter @ragbase/frontend test`
- [x] Coverage ≥85% for `src/api/` and `src/hooks/`

## Run Tests

```bash
# Run all unit tests
pnpm --filter @ragbase/frontend test

# Watch mode
pnpm --filter @ragbase/frontend test:watch

# Coverage report
pnpm --filter @ragbase/frontend test:coverage
```

## Coverage Target

| File | Target |
|------|--------|
| `api/client.ts` | 90%+ |
| `hooks/use-documents.ts` | 85%+ |
| `hooks/use-query.ts` | 85%+ |

## Notes

- **Polling tests:** Use `waitFor` with longer timeout (10s) to allow multiple polls
- **MSW dynamic responses:** Use `server.use()` to override handlers per test
- **File upload:** Use `File` constructor to create test files
- **TanStack Query:** Wrapper provides `QueryClient` with retries disabled

## Next Phase

→ [Phase 03: Component Integration Tests](./phase-03-component-tests.md)
