# Phase 05: Queue & Callbacks (TDD)

**Parent:** [plan.md](./plan.md) | **Status:** DONE | **Priority:** P0

## Objectives
Setup BullMQ for async tasks and AI Worker callback mechanism.

## Acceptance Criteria
- [x] BullMQ + Redis integration implemented (`processing-queue.ts`).
- [x] Task lanes: fast (Node) vs. heavy (Python AI Worker) defined.
- [x] AI Worker callback handles status updates (`callback-route.ts`).
- [x] Retry mechanism for failed tasks tested (`retry-handler.test.ts`).
- [x] **Wiring**: Integrated real queue into `upload-route.ts`.
- [x] **Worker**: Initialized BullMQ worker in `app.ts`.

## Key Files
- `apps/backend/src/queue/processing-queue.ts`: BullMQ setup.
- `apps/backend/src/queue/job-processor.ts`: Job handling logic.
- `apps/backend/src/routes/internal/callback-route.ts`: AI Worker hook.
- `tests/integration/queue/`: Integration tests for queue logic.

## Implementation Steps
1. Set up BullMQ Queue and Worker.
2. Define Job payload and states (PENDING...FAILED).
3. Implement internal callback route.
4. Write tests mocking AI Worker callbacks.

## Verification
- Push jobs; check Redis (BullBoard).
- End-to-end integration: upload -> queue -> callback.
