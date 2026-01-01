# Phase 04: API Routes Integration (TDD)

**Parent:** [plan.md](./plan.md) | **Status:** ✅ **DONE** | **Priority:** P0

## Objectives
Build production-ready REST API with Fastify routes, integrate validation/services/database, implement dual-lane processing (fast/heavy), and ensure comprehensive integration testing.

## Acceptance Criteria
- [x] 6 API routes (upload, status, list, search, callback, health)
- [x] 880 lines of integration tests across 5 test files
- [x] Dual-lane processing: fast (JSON/TXT/MD) + heavy (PDF with queue)
- [x] Auth middleware with timing-safe comparison
- [x] Zod validation integration
- [x] Prisma database operations
- [x] pgvector semantic search
- [x] MD5 deduplication
- [x] Multipart file upload support

## Key Files & Components

### Routes (Source)
- `apps/backend/src/routes/documents/upload-route.ts`: File upload (248 lines, dual-lane)
- `apps/backend/src/routes/documents/status-route.ts`: Document status retrieval
- `apps/backend/src/routes/documents/list-route.ts`: Paginated document listing
- `apps/backend/src/routes/query/search-route.ts`: pgvector semantic search
- `apps/backend/src/routes/internal/callback-route.ts`: AI worker callback
- `apps/backend/src/routes/health-route.ts`: Health/ready/live endpoints

### Middleware
- `apps/backend/src/middleware/auth-middleware.ts`: API key auth (timing-safe)

### Integration Tests (880 total lines)
- `apps/backend/tests/integration/routes/upload-route.test.ts`: 237 lines (upload, validation, auth, duplicates)
- `apps/backend/tests/integration/routes/status-route.test.ts`: Status retrieval tests
- `apps/backend/tests/integration/routes/list-route.test.ts`: Pagination, filtering tests
- `apps/backend/tests/integration/routes/search-route.test.ts`: Vector search tests
- `apps/backend/tests/integration/routes/callback-route.test.ts`: AI worker callback tests

## Implementation Details

### 1. Upload Route (POST /api/documents) - 248 lines
- Multipart upload (50MB), MD5 deduplication (409 if duplicate)
- **Dual-lane:** Fast (JSON/TXT/MD) → immediate chunk+embed+store | Heavy (PDF) → queue
- Filename sanitization, atomic operations (cleanup on failure)
- Test: uploads (PDF/JSON/TXT/MD), validation, auth, duplicates (237 lines)

### 2. Status Route (GET /api/documents/:id)
- UUID validation, retrieves document + chunk count
- Returns: id, filename, status, retryCount, failReason, chunkCount, timestamps
- Test: valid retrieval, 404, invalid UUID

### 3. List Route (GET /api/documents)
- Pagination (limit: 1-100, offset: ≥0), status filtering
- Ordered by createdAt DESC, returns total + documents
- Test: pagination, filtering, total count, empty results

### 4. Search Route (POST /api/query)
- Query validation (1-1000 chars, topK: 1-100)
- Embedding generation + pgvector cosine distance (`<=>`)
- Returns: content, score, documentId, metadata
- Test: successful search, empty results, validation, embedding errors

**pgvector Query:**
```sql
SELECT c.id, c.content, c.document_id, c.char_start, c.char_end, c.page, c.heading,
       1 - (c.embedding <=> $1::vector) as similarity
FROM chunks c ORDER BY c.embedding <=> $1::vector LIMIT $2
```

### 5. Callback Route (POST /internal/callback)
- AI worker callback handler, validates payload (Zod)
- Updates status (COMPLETED/FAILED), stores chunks or records error
- No auth (internal endpoint)
- Test: success callback, failure callback, invalid payload

### 6. Health Route
- `/health`: Basic liveness | `/ready`: DB+Redis+Queue | `/live`: Process liveness

### 7. Auth Middleware
- API key via `X-API-Key`, timing-safe comparison (`timingSafeEqual`)
- Public routes: `/health`, `/internal/callback`
- Constant-time comparison prevents timing attacks

## Verification

```bash
pnpm --filter @ragbase/backend test:integration  # All tests
pnpm --filter @ragbase/backend test:integration tests/integration/routes/upload-route.test.ts  # Specific
curl -X POST http://localhost:3000/api/documents -H "X-API-Key: key" -F "file=@test.pdf"  # Manual
```

## Critical Notes

### Dual-Lane Processing
- **Fast:** JSON/TXT/MD synchronous (immediate COMPLETED)
- **Heavy:** PDF async via queue (PENDING → PROCESSING → COMPLETED)
- Why: Fast formats don't need OCR/complex parsing
- Trade-off: Fast lane blocks request (acceptable for small files)

### MD5 Deduplication
- Hash before DB insert, prevents duplicates (409)
- Uses hash as filename (prevents path traversal)
- Atomic: cleanup file if DB fails

### pgvector Integration
- Cosine distance: `<=>` (0-2, 0=identical)
- Similarity: `1 - distance` (0-1 range)
- HNSW index for performance
- JSON.stringify for vector binding

### Error Handling
- 400: Validation | 401: Auth | 409: Duplicate | 500: Server | 503: Embedding service
- Cleanup on failure (file + DB rollback)

### Test Strategy
- Integration tests: Testcontainers (real DB + Redis)
- Multipart mock helper for uploads
- DB cleanup between tests
- Auth tested on all protected routes

### Security
- Timing-safe API key comparison (prevents timing attacks)
- Path traversal prevention (filename sanitization)
- File size limits (50MB)
- Public route whitelist
- No sensitive data in errors (production)
