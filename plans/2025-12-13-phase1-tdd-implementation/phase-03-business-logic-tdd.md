# Phase 03: Business Logic (TDD)

**Parent:** [plan.md](./plan.md) | **Status:** **DONE** | **Priority:** P0

## Objectives
Implement core logic: MD5 hashing, text chunking, and embedding generation in Node.js.

## Acceptance Criteria
- [x] MD5 hashing for document uniqueness (`hash-service.ts`).
- [x] LangChain `MarkdownTextSplitter` for accurate chunking (`chunker-service.ts`).
- [x] `fastembed` integration for 384d vectors (`embedding-service.ts`).
- [x] Implementation of `QualityGateService` for content validation.
- [x] Unit tests for Hashing, Chunking, and Quality Gate.

## Key Files
- `apps/backend/src/services/hash-service.ts`: MD5 handling.
- `apps/backend/src/services/chunker-service.ts`: Text splitting.
- `apps/backend/src/services/embedding-service.ts`: Vector generation via `fastembed`.
- `apps/backend/src/services/quality-gate-service.ts`: Content quality checks.

## Implementation Steps
1. Write tests for Hashing and Chunking.
2. Implement services.
3. Setup local embedding service (Xenova).
4. TDD cycle: Ensure logic is DB-independent at this stage.

## Verification
- `npm run test:unit` for services.
- Verify embedding vector has 384 dimensions.
