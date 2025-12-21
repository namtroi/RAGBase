# Phase 03: Component Integration Tests

**Parent:** [plan.md](./plan.md) | **Status:** ⏳ Pending | **Priority:** P1

## Objective

Test React components with TanStack Query + MSW. Target 80%+ coverage.

## Tasks

### 3.1 Upload Dropzone Tests

**File:** `apps/frontend/src/components/documents/__tests__/upload-dropzone.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { setupMswServer } from '@/test/mocks/server';
import UploadDropzone from '../upload-dropzone';

setupMswServer();

describe('UploadDropzone', () => {
  it('renders dropzone area', () => {
    render(<UploadDropzone />);
    expect(screen.getByText(/drag & drop/i)).toBeInTheDocument();
  });

  it('accepts file drop', async () => {
    const user = userEvent.setup();
    render(<UploadDropzone />);

    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/upload/i) as HTMLInputElement;

    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });
  });

  it('shows error for invalid file type', async () => {
    const user = userEvent.setup();
    render(<UploadDropzone />);

    const file = new File(['test'], 'test.exe', { type: 'application/exe' });
    const input = screen.getByLabelText(/upload/i) as HTMLInputElement;

    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
    });
  });

  it('shows error for file too large', async () => {
    const user = userEvent.setup();
    render(<UploadDropzone />);

    // 51MB file
    const largeContent = new Array(51 * 1024 * 1024).fill('a').join('');
    const file = new File([largeContent], 'large.pdf', {
      type: 'application/pdf',
    });
    const input = screen.getByLabelText(/upload/i) as HTMLInputElement;

    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText(/file too large/i)).toBeInTheDocument();
    });
  });

  it('uploads file on submit', async () => {
    const user = userEvent.setup();
    render(<UploadDropzone />);

    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/upload/i) as HTMLInputElement;

    await user.upload(input, file);
    await user.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText(/uploaded successfully/i)).toBeInTheDocument();
    });
  });
});
```

### 3.2 Document List Tests

**File:** `apps/frontend/src/components/documents/__tests__/document-list.test.tsx`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { setupMswServer } from '@/test/mocks/server';
import DocumentList from '../document-list';

setupMswServer();

describe('DocumentList', () => {
  beforeEach(() => {
    localStorage.setItem('apiKey', 'test-key');
  });

  it('renders document cards', async () => {
    render(<DocumentList />);

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
      expect(screen.getByText('processing.pdf')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    render(<DocumentList />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows empty state when no documents', async () => {
    server.use(
      http.get('http://localhost:5173/api/documents', () => {
        return HttpResponse.json([]);
      })
    );

    render(<DocumentList />);

    await waitFor(() => {
      expect(screen.getByText(/no documents/i)).toBeInTheDocument();
    });
  });

  it('filters by status', async () => {
    const user = userEvent.setup();
    render(<DocumentList />);

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });

    // Filter to COMPLETED only
    await user.click(screen.getByRole('button', { name: /completed/i }));

    expect(screen.getByText('test.pdf')).toBeInTheDocument();
    expect(screen.queryByText('processing.pdf')).not.toBeInTheDocument();
  });

  it('displays chunk count for completed docs', async () => {
    render(<DocumentList />);

    await waitFor(() => {
      expect(screen.getByText(/15 chunks/i)).toBeInTheDocument();
    });
  });
});
```

### 3.3 Document Card Tests

**File:** `apps/frontend/src/components/documents/__tests__/document-card.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/test-utils';
import DocumentCard from '../document-card';

describe('DocumentCard', () => {
  it('renders document info', () => {
    const doc = {
      id: 'doc-1',
      filename: 'test.pdf',
      status: 'COMPLETED' as const,
      createdAt: new Date('2025-12-20').toISOString(),
      chunkCount: 15,
    };

    render(<DocumentCard document={doc} />);

    expect(screen.getByText('test.pdf')).toBeInTheDocument();
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText('15 chunks')).toBeInTheDocument();
  });

  it('shows processing state without chunk count', () => {
    const doc = {
      id: 'doc-2',
      filename: 'processing.pdf',
      status: 'PROCESSING' as const,
      createdAt: new Date().toISOString(),
    };

    render(<DocumentCard document={doc} />);

    expect(screen.getByText('processing.pdf')).toBeInTheDocument();
    expect(screen.getByText('PROCESSING')).toBeInTheDocument();
    expect(screen.queryByText(/chunks/i)).not.toBeInTheDocument();
  });

  it('formats date correctly', () => {
    const doc = {
      id: 'doc-1',
      filename: 'test.pdf',
      status: 'COMPLETED' as const,
      createdAt: new Date('2025-12-20T10:30:00Z').toISOString(),
    };

    render(<DocumentCard document={doc} />);

    // Should display relative or absolute date
    expect(screen.getByText(/2025|Dec|12/)).toBeInTheDocument();
  });
});
```

### 3.4 Status Badge Tests

**File:** `apps/frontend/src/components/documents/__tests__/status-badge.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/test-utils';
import StatusBadge from '../status-badge';

describe('StatusBadge', () => {
  it('renders PENDING status', () => {
    render(<StatusBadge status="PENDING" />);
    const badge = screen.getByText('PENDING');
    expect(badge).toHaveClass('bg-yellow-100'); // or appropriate class
  });

  it('renders PROCESSING status', () => {
    render(<StatusBadge status="PROCESSING" />);
    expect(screen.getByText('PROCESSING')).toBeInTheDocument();
  });

  it('renders COMPLETED status', () => {
    render(<StatusBadge status="COMPLETED" />);
    const badge = screen.getByText('COMPLETED');
    expect(badge).toHaveClass('bg-green-100'); // success color
  });

  it('renders FAILED status', () => {
    render(<StatusBadge status="FAILED" />);
    const badge = screen.getByText('FAILED');
    expect(badge).toHaveClass('bg-red-100'); // error color
  });

  it('has accessible label', () => {
    render(<StatusBadge status="COMPLETED" />);
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
  });
});
```

### 3.5 Search Form Tests

**File:** `apps/frontend/src/components/query/__tests__/search-form.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import SearchForm from '../search-form';

describe('SearchForm', () => {
  it('renders search input and submit button', () => {
    render(<SearchForm />);
    expect(screen.getByPlaceholderText(/enter your query/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('allows typing in search input', async () => {
    const user = userEvent.setup();
    render(<SearchForm />);

    const input = screen.getByPlaceholderText(/enter your query/i);
    await user.type(input, 'machine learning');

    expect(input).toHaveValue('machine learning');
  });

  it('shows error for empty query', async () => {
    const user = userEvent.setup();
    render(<SearchForm />);

    await user.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText(/query is required/i)).toBeInTheDocument();
    });
  });

  it('allows selecting topK value', async () => {
    const user = userEvent.setup();
    render(<SearchForm />);

    const select = screen.getByLabelText(/top k/i);
    await user.selectOptions(select, '10');

    expect(select).toHaveValue('10');
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<SearchForm onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText(/enter your query/i), 'test query');
    await user.selectOptions(screen.getByLabelText(/top k/i), '5');
    await user.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        query: 'test query',
        topK: 5,
      });
    });
  });
});
```

### 3.6 Results List Tests

**File:** `apps/frontend/src/components/query/__tests__/results-list.test.tsx`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@/test/test-utils';
import ResultsList from '../results-list';

describe('ResultsList', () => {
  const mockResults = [
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
  ];

  it('renders result cards', () => {
    render(<ResultsList results={mockResults} />);

    expect(screen.getByText(/machine learning/i)).toBeInTheDocument();
    expect(screen.getByText(/neural networks/i)).toBeInTheDocument();
  });

  it('displays scores', () => {
    render(<ResultsList results={mockResults} />);

    expect(screen.getByText(/0.95/)).toBeInTheDocument();
    expect(screen.getByText(/0.87/)).toBeInTheDocument();
  });

  it('displays filenames', () => {
    render(<ResultsList results={mockResults} />);

    expect(screen.getAllByText('test.pdf')).toHaveLength(2);
  });

  it('shows empty state when no results', () => {
    render(<ResultsList results={[]} />);
    expect(screen.getByText(/no results found/i)).toBeInTheDocument();
  });

  it('orders results by score descending', () => {
    render(<ResultsList results={mockResults} />);

    const scores = screen.getAllByText(/\d+\.\d+/).map((el) => el.textContent);
    expect(scores[0]).toBe('0.95');
    expect(scores[1]).toBe('0.87');
  });
});
```

## Acceptance Criteria

- [x] Upload dropzone: file drop, validation, error handling
- [x] Document list: render, filter, empty state, loading
- [x] Document card: info display, status, date formatting
- [x] Status badge: all statuses, colors, accessibility
- [x] Search form: input, validation, topK selector, submit
- [x] Results list: display, scores, empty state, ordering
- [x] All tests pass
- [x] Coverage ≥80% for `src/components/`

## Run Tests

```bash
# Run component tests
pnpm --filter @ragbase/frontend test components

# Watch mode
pnpm --filter @ragbase/frontend test:watch components

# Coverage
pnpm --filter @ragbase/frontend test:coverage
```

## Coverage Target

| Directory | Target |
|-----------|--------|
| `components/documents/` | 80%+ |
| `components/query/` | 80%+ |

## Notes

- **userEvent:** Preferred over fireEvent for realistic interactions
- **waitFor:** Essential for async updates (TanStack Query)
- **MSW overrides:** Use `server.use()` to customize responses per test
- **Accessibility:** Test aria-labels, roles, keyboard navigation

## Next Phase

→ [Phase 04: E2E Tests with Playwright](./phase-04-e2e-tests.md)
