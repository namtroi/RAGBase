# Phase 08: Frontend UI

**Parent:** [plan.md](./plan.md) | **Dependencies:** Phase 04 (API routes) | **Blocks:** None

---

## Overview

| Field | Value |
|-------|-------|
| Date | 2025-12-13 |
| Priority | P1 (Important) |
| Est. Hours | 8 |
| Status | Pending |

**Description:** React + Vite + Tailwind CSS dashboard for document upload, status monitoring, and vector search. Uses TanStack Query for server state.

---

## Key Insights

- Pure Tailwind CSS (no component libraries for Phase 1)
- TanStack Query for data fetching and caching
- File upload with drag-and-drop via react-dropzone
- Polling for document status updates
- Simple API key auth via header

---

## Requirements

### Acceptance Criteria
- [ ] Upload component with drag-and-drop
- [ ] Document list with status badges
- [ ] Status polling for processing documents
- [ ] Query interface with results display
- [ ] API key configuration UI
- [ ] Responsive design (desktop + tablet)

---

## Architecture

### Frontend Structure

```
apps/frontend/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── header.tsx
│   │   │   ├── sidebar.tsx
│   │   │   └── layout.tsx
│   │   ├── documents/
│   │   │   ├── upload-dropzone.tsx
│   │   │   ├── document-list.tsx
│   │   │   ├── document-card.tsx
│   │   │   └── status-badge.tsx
│   │   ├── query/
│   │   │   ├── search-form.tsx
│   │   │   └── results-list.tsx
│   │   └── common/
│   │       ├── button.tsx
│   │       ├── input.tsx
│   │       ├── card.tsx
│   │       └── spinner.tsx
│   ├── hooks/
│   │   ├── use-documents.ts
│   │   ├── use-upload.ts
│   │   ├── use-query.ts
│   │   └── use-api-key.ts
│   ├── api/
│   │   ├── client.ts
│   │   └── endpoints.ts
│   ├── pages/
│   │   ├── documents.tsx
│   │   ├── query.tsx
│   │   └── settings.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## Related Code Files

| File | Purpose |
|------|---------|
| `apps/frontend/src/components/documents/upload-dropzone.tsx` | File upload |
| `apps/frontend/src/components/documents/document-list.tsx` | Document listing |
| `apps/frontend/src/components/query/search-form.tsx` | Search interface |
| `apps/frontend/src/hooks/use-documents.ts` | Document queries |
| `apps/frontend/src/api/client.ts` | API client setup |

---

## Implementation Steps

### Step 1: Project Setup

```json
// apps/frontend/package.json
{
  "name": "@schemaforge/frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext ts,tsx"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.27.0",
    "@tanstack/react-query": "^5.59.0",
    "react-dropzone": "^14.2.0",
    "lucide-react": "^0.453.0",
    "clsx": "^2.1.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

### Step 2: Vite Configuration

```typescript
// apps/frontend/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

### Step 3: Tailwind Configuration

```javascript
// apps/frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
    },
  },
  plugins: [],
};
```

### Step 4: API Client

```typescript
// apps/frontend/src/api/client.ts
const API_BASE = '/api';

interface ApiConfig {
  apiKey: string;
}

let config: ApiConfig = {
  apiKey: localStorage.getItem('apiKey') || '',
};

export function setApiKey(key: string) {
  config.apiKey = key;
  localStorage.setItem('apiKey', key);
}

export function getApiKey(): string {
  return config.apiKey;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'X-API-Key': config.apiKey,
      'Content-Type': options.body instanceof FormData
        ? undefined as any
        : 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),

  post: <T>(endpoint: string, data?: any) =>
    request<T>(endpoint, {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data),
    }),

  upload: <T>(endpoint: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<T>(endpoint, {
      method: 'POST',
      body: formData,
    });
  },
};
```

### Step 5: API Endpoints

```typescript
// apps/frontend/src/api/endpoints.ts
import { api } from './client';

// Types
export interface Document {
  id: string;
  filename: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  format: string;
  lane: string;
  chunkCount?: number;
  failReason?: string;
  createdAt: string;
}

export interface QueryResult {
  content: string;
  score: number;
  documentId: string;
  metadata: {
    charStart: number;
    charEnd: number;
    page?: number;
    heading?: string;
  };
}

// Document endpoints
export const documentsApi = {
  list: (params?: { status?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const queryStr = query.toString();
    return api.get<{ documents: Document[]; total: number }>(
      `/documents${queryStr ? `?${queryStr}` : ''}`
    );
  },

  get: (id: string) => api.get<Document>(`/documents/${id}`),

  upload: (file: File) =>
    api.upload<{ id: string; filename: string; status: string; format: string; lane: string }>(
      '/documents',
      file
    ),
};

// Query endpoint
export const queryApi = {
  search: (query: string, topK = 5) =>
    api.post<{ results: QueryResult[] }>('/query', { query, topK }),
};
```

### Step 6: TanStack Query Hooks

```typescript
// apps/frontend/src/hooks/use-documents.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi, Document } from '@/api/endpoints';

export function useDocuments(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['documents', params],
    queryFn: () => documentsApi.list(params),
    refetchInterval: (data) => {
      // Poll if any documents are processing
      const hasProcessing = data?.documents?.some(
        (d) => d.status === 'PENDING' || d.status === 'PROCESSING'
      );
      return hasProcessing ? 3000 : false; // Poll every 3s
    },
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: () => documentsApi.get(id),
    enabled: !!id,
    refetchInterval: (data) => {
      const status = data?.status;
      return status === 'PENDING' || status === 'PROCESSING' ? 2000 : false;
    },
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => documentsApi.upload(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}
```

```typescript
// apps/frontend/src/hooks/use-query.ts
import { useMutation } from '@tanstack/react-query';
import { queryApi, QueryResult } from '@/api/endpoints';

export function useSearch() {
  return useMutation({
    mutationFn: ({ query, topK }: { query: string; topK?: number }) =>
      queryApi.search(query, topK),
  });
}
```

### Step 7: Upload Dropzone Component

```tsx
// apps/frontend/src/components/documents/upload-dropzone.tsx
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, AlertCircle, CheckCircle } from 'lucide-react';
import { useUploadDocument } from '@/hooks/use-documents';
import clsx from 'clsx';

const ACCEPTED_FORMATS = {
  'application/pdf': ['.pdf'],
  'application/json': ['.json'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
};

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export function UploadDropzone() {
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const uploadMutation = useUploadDocument();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      setUploadStatus({ type: null, message: '' });

      try {
        const result = await uploadMutation.mutateAsync(file);
        setUploadStatus({
          type: 'success',
          message: `Uploaded ${result.filename} - ${result.lane} lane`,
        });
      } catch (error: any) {
        setUploadStatus({
          type: 'error',
          message: error.message || 'Upload failed',
        });
      }
    },
    [uploadMutation]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept: ACCEPTED_FORMATS,
      maxSize: MAX_SIZE,
      multiple: false,
    });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={clsx(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-gray-400',
          uploadMutation.isPending && 'opacity-50 pointer-events-none'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        {isDragActive ? (
          <p className="text-primary-600 font-medium">Drop the file here</p>
        ) : (
          <>
            <p className="text-gray-600 font-medium">
              Drag and drop a file here, or click to select
            </p>
            <p className="text-sm text-gray-500 mt-2">
              PDF, JSON, TXT, MD (max 50MB)
            </p>
          </>
        )}
      </div>

      {/* Upload status */}
      {uploadStatus.type && (
        <div
          className={clsx(
            'flex items-center gap-2 p-3 rounded-lg',
            uploadStatus.type === 'success'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          )}
        >
          {uploadStatus.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{uploadStatus.message}</span>
        </div>
      )}

      {/* File rejections */}
      {fileRejections.length > 0 && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg">
          <p className="font-medium">File rejected:</p>
          {fileRejections.map(({ file, errors }) => (
            <p key={file.name} className="text-sm">
              {file.name}: {errors.map((e) => e.message).join(', ')}
            </p>
          ))}
        </div>
      )}

      {/* Loading state */}
      {uploadMutation.isPending && (
        <div className="flex items-center gap-2 text-gray-600">
          <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-primary-500 rounded-full" />
          <span>Uploading...</span>
        </div>
      )}
    </div>
  );
}
```

### Step 8: Document List Component

```tsx
// apps/frontend/src/components/documents/document-list.tsx
import { useState } from 'react';
import { useDocuments } from '@/hooks/use-documents';
import { DocumentCard } from './document-card';
import { StatusBadge } from './status-badge';
import { FileText, RefreshCw } from 'lucide-react';

type StatusFilter = 'all' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export function DocumentList() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data, isLoading, refetch, isRefetching } = useDocuments({
    status: statusFilter === 'all' ? undefined : statusFilter,
    limit: 20,
  });

  const filters: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Processing', value: 'PROCESSING' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Failed', value: 'FAILED' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          <RefreshCw
            className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {filters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatusFilter(filter.value)}
            className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap ${
              statusFilter === filter.value
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Document list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-primary-500 rounded-full" />
        </div>
      ) : data?.documents.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No documents found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.documents.map((doc) => (
            <DocumentCard key={doc.id} document={doc} />
          ))}
        </div>
      )}

      {/* Total count */}
      {data && (
        <p className="text-sm text-gray-500">
          Showing {data.documents.length} of {data.total} documents
        </p>
      )}
    </div>
  );
}
```

### Step 9: Status Badge Component

```tsx
// apps/frontend/src/components/documents/status-badge.tsx
import { Clock, Loader, CheckCircle, XCircle } from 'lucide-react';
import clsx from 'clsx';

type Status = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

interface StatusBadgeProps {
  status: Status;
}

const statusConfig = {
  PENDING: {
    icon: Clock,
    label: 'Pending',
    className: 'bg-yellow-100 text-yellow-800',
  },
  PROCESSING: {
    icon: Loader,
    label: 'Processing',
    className: 'bg-blue-100 text-blue-800',
  },
  COMPLETED: {
    icon: CheckCircle,
    label: 'Completed',
    className: 'bg-green-100 text-green-800',
  },
  FAILED: {
    icon: XCircle,
    label: 'Failed',
    className: 'bg-red-100 text-red-800',
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        config.className
      )}
    >
      <Icon
        className={clsx(
          'w-3.5 h-3.5',
          status === 'PROCESSING' && 'animate-spin'
        )}
      />
      {config.label}
    </span>
  );
}
```

### Step 10: Search Form Component

```tsx
// apps/frontend/src/components/query/search-form.tsx
import { useState } from 'react';
import { Search, Loader } from 'lucide-react';
import { useSearch } from '@/hooks/use-query';
import { ResultsList } from './results-list';

export function SearchForm() {
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(5);

  const searchMutation = useSearch();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      searchMutation.mutate({ query: query.trim(), topK });
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="query"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Search Query
          </label>
          <div className="relative">
            <input
              id="query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your search query..."
              className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              maxLength={1000}
            />
            <button
              type="submit"
              disabled={!query.trim() || searchMutation.isPending}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-primary-500 disabled:opacity-50"
            >
              {searchMutation.isPending ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-600">Results:</label>
          <select
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            {[3, 5, 10, 20].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </form>

      {/* Results */}
      {searchMutation.data && (
        <ResultsList results={searchMutation.data.results} />
      )}

      {/* Error */}
      {searchMutation.isError && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          <p className="font-medium">Search failed</p>
          <p className="text-sm">
            {(searchMutation.error as Error).message}
          </p>
        </div>
      )}
    </div>
  );
}
```

### Step 11: Results List Component

```tsx
// apps/frontend/src/components/query/results-list.tsx
import { QueryResult } from '@/api/endpoints';
import { FileText, Star } from 'lucide-react';

interface ResultsListProps {
  results: QueryResult[];
}

export function ResultsList({ results }: ResultsListProps) {
  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No results found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">
        Results ({results.length})
      </h3>

      <div className="space-y-3">
        {results.map((result, index) => (
          <div
            key={`${result.documentId}-${index}`}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            {/* Score and metadata */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <FileText className="w-4 h-4" />
                <span className="font-mono text-xs">
                  {result.documentId.slice(0, 8)}...
                </span>
                {result.metadata.page && (
                  <span>Page {result.metadata.page}</span>
                )}
                {result.metadata.heading && (
                  <span className="text-primary-600">
                    {result.metadata.heading}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-amber-500">
                <Star className="w-4 h-4 fill-current" />
                <span className="text-sm font-medium">
                  {(result.score * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Content */}
            <p className="text-gray-700 text-sm line-clamp-4">
              {result.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

import { Search } from 'lucide-react';
```

### Step 12: Main App Component

```tsx
// apps/frontend/src/App.tsx
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UploadDropzone } from '@/components/documents/upload-dropzone';
import { DocumentList } from '@/components/documents/document-list';
import { SearchForm } from '@/components/query/search-form';
import { Settings, FileText, Search, Key } from 'lucide-react';
import { setApiKey, getApiKey } from '@/api/client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10000,
    },
  },
});

type Tab = 'documents' | 'query' | 'settings';

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>('documents');
  const [apiKey, setApiKeyState] = useState(getApiKey());

  const handleApiKeyChange = (key: string) => {
    setApiKeyState(key);
    setApiKey(key);
  };

  const tabs = [
    { id: 'documents' as Tab, label: 'Documents', icon: FileText },
    { id: 'query' as Tab, label: 'Search', icon: Search },
    { id: 'settings' as Tab, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">SchemaForge</h1>
            <div className="flex items-center gap-2">
              {!apiKey && (
                <span className="text-sm text-amber-600 flex items-center gap-1">
                  <Key className="w-4 h-4" />
                  API key required
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex gap-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {activeTab === 'documents' && (
          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Upload Document
              </h2>
              <UploadDropzone />
            </section>

            <section>
              <DocumentList />
            </section>
          </div>
        )}

        {activeTab === 'query' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Vector Search
            </h2>
            <SearchForm />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Settings
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <label
                htmlFor="apiKey"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                API Key
              </label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="Enter your API key"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="mt-2 text-sm text-gray-500">
                Your API key is stored locally in your browser.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
```

---

## Todo List

- [ ] Create `apps/frontend/package.json`
- [ ] Create `apps/frontend/vite.config.ts`
- [ ] Create `apps/frontend/tailwind.config.js`
- [ ] Create `apps/frontend/src/api/client.ts`
- [ ] Create `apps/frontend/src/api/endpoints.ts`
- [ ] Create `apps/frontend/src/hooks/use-documents.ts`
- [ ] Create `apps/frontend/src/hooks/use-query.ts`
- [ ] Create upload dropzone component
- [ ] Create document list component
- [ ] Create status badge component
- [ ] Create search form component
- [ ] Create results list component
- [ ] Create main App.tsx
- [ ] Test with backend API
- [ ] Verify responsive design

---

## Success Criteria

1. `pnpm dev` starts frontend on localhost:5173
2. File upload works via drag-and-drop
3. Document list shows real-time status
4. Search returns and displays results
5. API key configuration persists

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| API CORS issues | Vite proxy in dev |
| Large file uploads | Progress indicator |
| Status polling load | Conditional polling |

---

## Security Considerations

- API key stored in localStorage (clear on logout)
- No sensitive data in client code
- All API calls via proxy in dev

---

## Next Steps

After completion, UI is functional. Proceed to [Phase 09: Production Readiness](./phase-09-production-readiness.md) for logging, metrics, and hardening.
