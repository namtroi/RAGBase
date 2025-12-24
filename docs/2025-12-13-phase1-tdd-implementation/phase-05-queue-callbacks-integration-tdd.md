# Phase 05: Queue & Callbacks (TDD)

**Parent:** [plan.md](./plan.md) | **Status:** ✅ **DONE** | **Priority:** P0

## Objectives
Implement BullMQ async task queue with Redis, HTTP dispatch to AI worker, retry mechanism with exponential backoff, and callback handling for processing results.

## Acceptance Criteria
- [x] BullMQ + Redis integration (processing-queue.ts)
- [x] HTTP dispatch pattern to AI worker (job-processor.ts)
- [x] Retry mechanism: 3 attempts, exponential backoff (5s base)
- [x] Permanent error handling (UnrecoverableError)
- [x] Worker lifecycle management (init, shutdown)
- [x] Callback route for AI worker results
- [x] 449 lines of integration tests (3 test files)
- [x] Integrated into upload route and app.ts

## Key Files & Components

### Queue Infrastructure
- `apps/backend/src/queue/processing-queue.ts`: BullMQ queue setup (67 lines)
- `apps/backend/src/queue/job-processor.ts`: Job processing logic (119 lines)
- `apps/backend/src/queue/worker-init.ts`: Worker lifecycle (33 lines)

### Callback Handling
- `apps/backend/src/routes/internal/callback-route.ts`: AI worker callback endpoint

### Integration Tests (449 total lines)
- `apps/backend/tests/integration/queue/processing-queue.test.ts`: 103 lines (job creation, queue state)
- `apps/backend/tests/integration/queue/retry-handler.test.ts`: Retry logic tests
- `apps/backend/tests/integration/queue/fast-lane.test.ts`: Fast lane processing tests

## Implementation Details

### 1. Processing Queue (processing-queue.ts)
**Features:**
- BullMQ Queue with Redis connection
- Singleton pattern (lazy initialization)
- Default job options: 3 attempts, exponential backoff (5s base)
- Auto-cleanup: completed (1h, 1000 jobs), failed (24h)
- Connection management (disconnect on close)

**Configuration:**
```typescript
{
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 86400 }
}
```

### 2. Job Processor (job-processor.ts)
**Features:**
- HTTP dispatch to AI worker (`/process` endpoint)
- Status updates: PENDING → PROCESSING → COMPLETED/FAILED
- Retry tracking (attemptsMade)
- Permanent error detection (PASSWORD_PROTECTED, CORRUPT_FILE, UNSUPPORTED_FORMAT)
- UnrecoverableError for non-retryable failures
- Concurrency: 5 workers
- Lock duration: 5 minutes

**Flow:**
1. Update document status to PROCESSING
2. Dispatch HTTP POST to AI worker (`http://localhost:8000/process`)
3. AI worker processes PDF asynchronously
4. AI worker sends callback to `/internal/callback`
5. Callback updates status to COMPLETED/FAILED

**Error Handling:**
- Permanent errors → UnrecoverableError (no retry)
- Document not found (P2025) → UnrecoverableError
- Max attempts reached → mark FAILED
- Temporary errors → retry with exponential backoff

### 3. Worker Lifecycle (worker-init.ts)
**Features:**
- Singleton worker instance
- Separate Redis connection for worker
- Graceful shutdown (close worker + disconnect Redis)
- Initialized in `app.ts` (skipped in test mode)

### 4. Callback Route (callback-route.ts)
**Features:**
- Validates callback payload (Zod)
- Success: stores chunks with embeddings, updates status to COMPLETED
- Failure: records error reason, updates status to FAILED
- No authentication (internal endpoint)

### 5. Integration Points
**Upload Route:**
- Heavy lane (PDF) → adds job to queue
- Fast lane (JSON/TXT/MD) → immediate processing (no queue)

**App.ts:**
- Initializes worker on startup (if not test mode)
- Graceful shutdown: worker → queue → database

## Verification

```bash
pnpm --filter @ragbase/backend test:integration tests/integration/queue  # Queue tests
redis-cli -u $REDIS_URL  # Monitor: KEYS bull:document-processing:*
curl -X POST http://localhost:3000/api/documents -H "X-API-Key: key" -F "file=@test.pdf"  # E2E
```

## Critical Notes

### HTTP Dispatch Pattern
- **Architecture:** Backend worker dispatches HTTP to AI worker (not both consuming queue)
- **Why:** Avoids race conditions, simpler error handling
- **Flow:** Upload → Queue → Worker HTTP dispatch → AI processes → Callback
- **Trade-off:** AI worker must be running (not fully async)

### Retry Strategy
- **Attempts:** 3 max
- **Backoff:** Exponential (5s, 10s, 20s)
- **Permanent errors:** No retry (UnrecoverableError)
- **Max attempts:** Mark FAILED after 3 attempts

### Permanent Errors
- PASSWORD_PROTECTED: PDF requires password
- CORRUPT_FILE: File is corrupted
- UNSUPPORTED_FORMAT: Format not supported
- Document not found (P2025): DB record missing

### Queue Configuration
- **Concurrency:** 5 workers (parallel processing)
- **Lock duration:** 5 minutes (prevents timeout on long PDFs)
- **Cleanup:** Auto-remove completed (1h) and failed (24h) jobs
- **Connection:** Separate Redis connections for queue and worker

### Test Strategy
- Integration tests use Testcontainers (real Redis)
- Job creation, queue state, retry logic tested
- Fast lane processing tested separately
- Callback route tested in routes integration tests

### Performance
- Exponential backoff prevents Redis overload
- Auto-cleanup prevents memory bloat
- Concurrency=5 balances throughput and resource usage
- Lock duration=5min handles long-running PDFs
