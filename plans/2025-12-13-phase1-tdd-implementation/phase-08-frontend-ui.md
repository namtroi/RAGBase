# Phase 08: Frontend UI

**Parent:** [plan.md](./plan.md) | **Status:** ✅ Completed | **Priority:** P1

## Objectives
Build a simple Web UI for file uploads and visual knowledge queries.

## Acceptance Criteria
- [x] Drag & Drop upload support.
- [x] Document list with real-time status (via polling).
- [x] Simple search interface for queries and chunk results.
- [x] Responsive UI via Tailwind CSS v4.

## Key Files

### Core
| File | Description |
|------|-------------|
| [`App.tsx`](file:///home/namtroi/RAGBase/apps/frontend/src/App.tsx) | Main app with tab navigation (Documents, Search, Settings) |
| [`main.tsx`](file:///home/namtroi/RAGBase/apps/frontend/src/main.tsx) | Entry point |
| [`index.css`](file:///home/namtroi/RAGBase/apps/frontend/src/index.css) | Tailwind v4 theme config |

### API Layer
| File | Description |
|------|-------------|
| [`api/client.ts`](file:///home/namtroi/RAGBase/apps/frontend/src/api/client.ts) | Fetch wrapper with API key management |
| [`api/endpoints.ts`](file:///home/namtroi/RAGBase/apps/frontend/src/api/endpoints.ts) | Documents & Query API endpoints |

### Components
| File | Description |
|------|-------------|
| [`documents/upload-dropzone.tsx`](file:///home/namtroi/RAGBase/apps/frontend/src/components/documents/upload-dropzone.tsx) | Drag & drop upload with react-dropzone |
| [`documents/document-list.tsx`](file:///home/namtroi/RAGBase/apps/frontend/src/components/documents/document-list.tsx) | Document list with status filters |
| [`documents/document-card.tsx`](file:///home/namtroi/RAGBase/apps/frontend/src/components/documents/document-card.tsx) | Individual document display |
| [`documents/status-badge.tsx`](file:///home/namtroi/RAGBase/apps/frontend/src/components/documents/status-badge.tsx) | Status badge component |
| [`query/search-form.tsx`](file:///home/namtroi/RAGBase/apps/frontend/src/components/query/search-form.tsx) | Search input with topK selector |
| [`query/results-list.tsx`](file:///home/namtroi/RAGBase/apps/frontend/src/components/query/results-list.tsx) | Query results display |

### Hooks
| File | Description |
|------|-------------|
| [`hooks/use-documents.ts`](file:///home/namtroi/RAGBase/apps/frontend/src/hooks/use-documents.ts) | useDocuments, useDocument, useUploadDocument hooks |
| [`hooks/use-query.ts`](file:///home/namtroi/RAGBase/apps/frontend/src/hooks/use-query.ts) | useSearch hook |

## Implementation Details

### Tech Stack
- **React 18** with TypeScript
- **Tailwind CSS v4** (via @tailwindcss/vite plugin)
- **React Query v5** for data fetching + auto-polling
- **react-dropzone** for drag & drop
- **lucide-react** for icons
- **Vite 7** with proxy to backend

### Real-time Status Updates
Uses **polling** (not WebSocket) via React Query's `refetchInterval`:
- Document list: polls every 3s if any document is PENDING/PROCESSING
- Individual document: polls every 2s while in progress

### API Integration
- Uses fetch (not Axios as originally planned)
- API key stored in localStorage, sent via `X-API-Key` header
- Vite proxy forwards `/api/*` to `http://localhost:3000`

## Verification
- [x] Upload → Process → Search → Results visible
- [x] Browser compatibility (Chrome/Firefox)

## Notes
- `src/pages/` directory exists but empty (single-page app, no routing used)
- `src/components/common/` directory exists but empty
