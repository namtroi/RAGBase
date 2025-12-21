# Phase 08: Frontend UI

**Parent:** [plan.md](./plan.md) | **Status:** Pending | **Priority:** P1

## Objectives
Build a simple Web UI for file uploads and visual knowledge queries.

## Acceptance Criteria
- [ ] Drag & Drop upload support.
- [ ] Document list with real-time status.
- [ ] Simple chat interface for queries and chunk results.
- [ ] Responsive UI via Tailwind CSS.

## Key Files
- `frontend/src/App.tsx`: Main logic.
- `frontend/src/components/Upload.tsx`: Upload component.
- `frontend/src/components/Chat.tsx`: Search interface.

## Implementation Steps
1. Init Vite + React + Tailwind project.
2. Connect to Backend API via Axios.
3. Implement polling/WebSockets for status updates.
4. Build UI for displaying query results (chunks).

## Verification
- Test: Upload -> Process -> Chat -> Results visible.
- Check browser compatibility (Chrome/Firefox).
