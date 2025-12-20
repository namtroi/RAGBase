# Phase 05: Queue & Callbacks (TDD)

**Parent:** [plan.md](./plan.md) | **Status:** Pending | **Priority:** P0

## Objectives
Setup BullMQ for async tasks and AI Worker callback mechanism.

## Acceptance Criteria
- [ ] Stable BullMQ + Redis integration.
- [ ] Task lanes: fast (Node) vs. heavy (Python AI Worker).
- [ ] AI Worker callback handles status updates.
- [ ] Retry mechanism for failed tasks.

## Key Files
- `src/queue/factory.ts`: BullMQ init.
- `src/queue/workers/callback.worker.ts`: Result handling.
- `src/routes/internal/callback.ts`: AI Worker hook.

## Implementation Steps
1. Set up BullMQ Queue and Worker.
2. Define Job payload and states (PENDING...FAILED).
3. Implement internal callback route.
4. Write tests mocking AI Worker callbacks.

## Verification
- Push jobs; check Redis (BullBoard).
- End-to-end integration: upload -> queue -> callback.
