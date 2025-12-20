# Phase 03: Business Logic (TDD)

**Parent:** [plan.md](./plan.md) | **Status:** Pending | **Priority:** P0

## Objectives
Implement core logic: MD5 hashing, text chunking, and embedding generation in Node.js.

## Acceptance Criteria
- [ ] MD5 hashing for document uniqueness.
- [ ] RecursiveCharacterTextSplitter for accurate chunking.
- [ ] @xenova/transformers integration for 384d vectors.
- [ ] 90%+ unit test coverage for data processing.

## Key Files
- `src/services/hash.service.ts`: MD5 handling.
- `src/services/chunking.service.ts`: Text splitting.
- `src/services/embedding.service.ts`: Vector generation.

## Implementation Steps
1. Write tests for Hashing and Chunking.
2. Implement services.
3. Setup local embedding service (Xenova).
4. TDD cycle: Ensure logic is DB-independent at this stage.

## Verification
- `npm run test:unit` for services.
- Verify embedding vector has 384 dimensions.
