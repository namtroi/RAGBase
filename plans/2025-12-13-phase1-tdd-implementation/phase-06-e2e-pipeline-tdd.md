# Phase 06: E2E Pipeline (TDD)

**Parent:** [plan.md](./plan.md) | **Status:** ✅ **DONE** | **Priority:** P0

## Objectives
Validate complete end-to-end pipeline from file upload through vector search, covering both fast and heavy lanes, error scenarios, and semantic query validation.

## Acceptance Criteria
- [x] 803 lines of E2E tests across 4 test suites
- [x] Full pipeline: Upload → Queue → Callback → Chunks → Query
- [x] Fast lane (JSON/TXT/MD) immediate processing
- [x] Heavy lane (PDF) queue + callback flow
- [x] Semantic search validation (topK, similarity, metadata)
- [x] Error scenarios (password-protected, corrupt, quality gate, duplicate, size limit)
- [x] Testcontainers setup (PostgreSQL + Redis)
- [x] 120s timeout for container startup

## Key Files & Components

### E2E Test Suites (803 total lines)
- `apps/backend/tests/e2e/pdf-upload-flow.test.ts`: 145 lines (PDF pipeline, heavy lane routing)
- `apps/backend/tests/e2e/query-flow.test.ts`: 231 lines (semantic search, topK, ordering, metadata)
- `apps/backend/tests/e2e/json-fast-lane.test.ts`: ~200 lines (JSON/TXT/MD fast lane, heading metadata)
- `apps/backend/tests/e2e/error-handling.test.ts`: ~227 lines (7 error scenarios)

### E2E Infrastructure
- `apps/backend/tests/e2e/setup/e2e-setup.ts`: Testcontainers setup (PostgreSQL + Redis)
- `apps/backend/vitest.e2e.config.ts`: E2E Vitest config (120s timeout, sequential execution)

## Implementation Details

### 1. PDF Upload Flow (145 lines)
**Full Pipeline Test:**
1. Upload PDF → 201 Created
2. Verify status: PENDING
3. Simulate Python worker callback (success)
4. Verify status: COMPLETED + chunkCount > 0
5. Query for content → results with documentId + score

**Heavy Lane Routing:**
- Verifies PDF routed to `lane: 'heavy'`

### 2. Query Flow (231 lines)
**Semantic Search Tests:**
- **Relevant results:** Query "machine learning" returns ML content
- **TopK limit:** Query with topK=5 returns exactly 5 results (from 20 chunks)
- **Similarity ordering:** Results sorted by score descending
- **Metadata inclusion:** charStart, charEnd, page, heading in results
- **Empty results:** No chunks → empty array (not error)

**Validation:**
- Scores in 0-1 range
- Results from correct documentId
- Metadata fields present when available

### 3. JSON Fast Lane (~200 lines)
**Immediate Processing:**
- JSON/TXT/MD processed without queue
- Status: PENDING → COMPLETED (no callback needed)
- Chunks created immediately

**Metadata Preservation:**
- Markdown heading extraction
- Character position tracking

### 4. Error Handling (~227 lines)
**7 Error Scenarios:**
1. **Password-protected PDF:** Callback with PASSWORD_PROTECTED → FAILED
2. **Quality gate - TEXT_TOO_SHORT:** Callback with short text → FAILED
3. **Quality gate - EXCESSIVE_NOISE:** Callback with noisy text → FAILED
4. **Duplicate file:** Same MD5 → 409 Conflict
5. **Unsupported format:** PNG upload → 400 Bad Request
6. **File size limit:** 51MB file → 413 Payload Too Large
7. **Corrupt file:** Callback with CORRUPT_FILE → FAILED

### 5. E2E Setup (e2e-setup.ts)
**Testcontainers:**
- PostgreSQL with pgvector extension
- Redis for queue
- Automatic schema push (not migrations)
- 120s startup timeout

**Test App:**
- Singleton Fastify instance
- Shared across tests (performance)
- Cleanup between tests (cleanDatabase)

## Verification

```bash
pnpm --filter @ragbase/backend test:e2e  # All E2E tests
pnpm --filter @ragbase/backend test:e2e tests/e2e/pdf-upload-flow.test.ts  # Specific suite
```

## Critical Notes

### Test Strategy
- **Sequential execution:** `fileParallelism: false` (prevents race conditions)
- **Testcontainers:** Real PostgreSQL + Redis (not mocks)
- **Shared app:** Singleton Fastify instance (performance)
- **Database cleanup:** Between tests (isolation)
- **120s timeout:** Container startup + first test

### Pipeline Validation
- **Upload → Queue:** PDF added to BullMQ
- **Queue → Callback:** Mock Python worker callback
- **Callback → Chunks:** Chunks stored with embeddings
- **Chunks → Query:** Semantic search returns results

### Fast vs Heavy Lane
- **Fast (JSON/TXT/MD):** Immediate processing, no queue
- **Heavy (PDF):** Queue + callback flow
- **Verification:** Lane field in upload response

### Error Scenario Coverage
- **Permanent errors:** PASSWORD_PROTECTED, CORRUPT_FILE
- **Quality gate:** TEXT_TOO_SHORT, EXCESSIVE_NOISE
- **Validation:** Duplicate (409), unsupported format (400), size limit (413)

### Semantic Search Validation
- **TopK:** Respects limit (5 from 20 chunks)
- **Ordering:** Results sorted by similarity descending
- **Metadata:** charStart, charEnd, page, heading included
- **Empty results:** Graceful handling (empty array)

### Test Infrastructure
- **Testcontainers lifecycle:** Start once, shared, auto-teardown
- **Prisma schema push:** Not migrations (faster for tests)
- **pgvector extension:** Auto-enabled in setup
- **Sequential execution:** Prevents DB conflicts

### Performance
- **Shared app:** Singleton reduces overhead
- **Container reuse:** Start once, not per test
- **Database cleanup:** Fast (DELETE, not DROP/CREATE)
- **120s timeout:** Handles slow container startup

### Not Implemented
- **Concurrent multi-file uploads:** Deferred (focus on happy-path + errors)
- **Future consideration:** Add if needed for load testing
