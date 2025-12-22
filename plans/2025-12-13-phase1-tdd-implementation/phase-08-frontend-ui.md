# Phase 08: Frontend UI

**Parent:** [plan.md](./plan.md) | **Status:** ✅ **DONE** | **Priority:** P1

## Objectives
Build production-ready React web UI for file uploads, document management, and semantic search with real-time status updates and responsive design.

## Acceptance Criteria
- [x] 771 lines of code across 12 TypeScript/React files
- [x] Drag & drop upload with react-dropzone
- [x] Document list with real-time status (React Query polling)
- [x] Semantic search interface with topK selector
- [x] Responsive UI with Tailwind CSS v4
- [x] API key management (localStorage)
- [x] Tab navigation (Documents, Search, Settings)
- [x] Status badges (PENDING, PROCESSING, COMPLETED, FAILED)

## Key Files & Components

### Core (771 total lines across 12 files)
- `App.tsx`: Main app with tab navigation
- `main.tsx`: Entry point with React 18
- `index.css`: Tailwind v4 theme config

### API Layer
- `api/client.ts`: Fetch wrapper with API key management
- `api/endpoints.ts`: Documents & Query API endpoints

### Components
- `documents/upload-dropzone.tsx`: Drag & drop with react-dropzone
- `documents/document-list.tsx`: Document list with status filters
- `documents/document-card.tsx`: Individual document display
- `documents/status-badge.tsx`: Status badge component
- `query/search-form.tsx`: Search input with topK selector
- `query/results-list.tsx`: Query results display

### Hooks
- `hooks/use-documents.ts`: useDocuments, useDocument, useUploadDocument
- `hooks/use-query.ts`: useSearch hook

## Implementation Details

### Tech Stack
- **React 18** with TypeScript (strict mode)
- **Tailwind CSS v4** via @tailwindcss/vite plugin
- **React Query v5** for data fetching + auto-polling
- **react-dropzone** for drag & drop
- **lucide-react** for icons
- **Vite 7** with proxy to backend

### Real-time Status Updates
**Polling Strategy (not WebSocket):**
- Document list: polls every 3s if any document is PENDING/PROCESSING
- Individual document: polls every 2s while in progress
- React Query's `refetchInterval` with conditional logic
- Auto-stops polling when all documents are COMPLETED/FAILED

### API Integration
- **Fetch API:** Native fetch (not Axios)
- **API Key:** Stored in localStorage, sent via `X-API-Key` header
- **Vite Proxy:** `/api/*` → `http://localhost:3000`
- **Error Handling:** Toast notifications for errors

### Features
**Upload:**
- Drag & drop or click to browse
- File type validation (PDF, JSON, TXT, MD)
- Size limit display (50MB)
- Upload progress indicator
- Duplicate detection (409 Conflict)

**Document List:**
- Status filtering (All, PENDING, PROCESSING, COMPLETED, FAILED)
- Real-time status updates (polling)
- Chunk count display (for COMPLETED)
- Retry count display (for FAILED)
- Timestamp formatting

**Search:**
- Query input with validation (1-1000 chars)
- TopK selector (1-100, default: 5)
- Results with similarity scores
- Metadata display (charStart, charEnd, page, heading)
- Empty state handling

**Settings:**
- API key configuration
- Backend URL configuration
- Save to localStorage

## Verification

```bash
cd apps/frontend && pnpm dev  # Start dev server (http://localhost:5173)
pnpm build  # Production build
pnpm preview  # Preview production build
```

**Manual Testing:**
1. Configure API key in Settings
2. Upload PDF → verify status updates (PENDING → PROCESSING → COMPLETED)
3. Search for content → verify results with scores
4. Test error scenarios (duplicate, unsupported format)

## Critical Notes

### Polling Strategy
- **Why polling:** Simpler than WebSocket, sufficient for MVP
- **Conditional:** Only polls when documents are in progress
- **Auto-stop:** Stops when all documents are done
- **Trade-off:** Slightly delayed updates (2-3s) vs WebSocket complexity

### State Management
- **React Query:** Server state (documents, search results)
- **useState:** Local UI state (active tab, filters)
- **localStorage:** API key, backend URL
- **No Redux:** React Query sufficient for this app

### Responsive Design
- **Mobile-first:** Tailwind CSS breakpoints
- **Tablet:** 2-column layout
- **Desktop:** 3-column layout
- **Touch-friendly:** Large click targets

### Performance
- **React Query caching:** Reduces API calls
- **Conditional polling:** Only when needed
- **Vite HMR:** Fast development
- **Code splitting:** Lazy loading (if needed)

### Not Implemented
- **WebSocket:** Deferred (polling sufficient)
- **Routing:** Single-page app (no react-router)
- **Authentication:** API key only (no user accounts)
- **Dark mode:** Not implemented (future enhancement)
