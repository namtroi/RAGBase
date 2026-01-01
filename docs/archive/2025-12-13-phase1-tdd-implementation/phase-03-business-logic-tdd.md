# Phase 03: Business Logic (TDD)

**Parent:** [plan.md](./plan.md) | **Status:** ✅ **DONE** | **Priority:** P0

## Objectives
Implement core RAG business logic: MD5 deduplication, LangChain-based chunking, fastembed vector generation, and quality gate validation - all DB-independent and fully tested.

## Acceptance Criteria
- [x] 4 core services (hash, chunker, embedding, quality gate)
- [x] 514 lines of unit tests across 4 test files
- [x] MD5 hashing with duplicate detection
- [x] LangChain MarkdownTextSplitter with overlap
- [x] Fastembed integration (384d vectors, batch processing)
- [x] Quality gate with configurable thresholds
- [x] Cosine similarity and top-K search
- [x] DB-independent, pure business logic

## Key Files & Components

### Services (Source)
- `apps/backend/src/services/hash-service.ts`: MD5 hashing and duplicate detection
- `apps/backend/src/services/chunker-service.ts`: LangChain text splitting with metadata
- `apps/backend/src/services/embedding-service.ts`: Fastembed vector generation and similarity
- `apps/backend/src/services/quality-gate-service.ts`: Content quality validation

### Unit Tests (514 total lines)
- `apps/backend/tests/unit/services/hash-service.test.ts`: 78 lines (MD5, consistency, duplicates)
- `apps/backend/tests/unit/services/chunker-service.test.ts`: 149 lines (splitting, overlap, metadata, markdown)
- `apps/backend/tests/unit/services/embedding-service.test.ts`: 143 lines (vectors, batching, similarity, top-K)
- `apps/backend/tests/unit/services/quality-gate-service.test.ts`: 148 lines (length, noise, thresholds, edge cases)

## Implementation Details

### 1. Hash Service
- MD5 hashing via Node.js `crypto` (32-char hex)
- Sync/async interfaces + duplicate detection (Set lookup)
- Tests: consistency, uniqueness, known hashes, duplicate detection

### 2. Chunker Service
- LangChain `MarkdownTextSplitter` with overlap
- Config: chunkSize (1000), chunkOverlap (200)
- Tracks charStart/charEnd, extracts headings
- Preserves markdown headers and code blocks
- Tests: single/multiple chunks, overlap, positions, markdown, empty input

### 3. Embedding Service
- Fastembed (all-MiniLM-L6-v2, 384d vectors)
- Singleton init, batch processing (size: 50)
- Cosine similarity + top-K search
- Float32Array → number[] conversion
- Tests: 384d output, consistency, batching, similarity, top-K

### 4. Quality Gate Service
- Min length (50 chars), noise ratio (non-alphanumeric)
- Two-tier: warn (0.5), reject (0.8)
- Whitespace-aware content length
- Results: passed, reason, warnings, noiseRatio, textLength
- Tests: length, noise (low/moderate/high), unicode, markdown, code

### 5. Design Principles
- **DB-Independent:** No Prisma, pure functions, testable without DB
- **Configurable:** Constructor config, env defaults, per-instance override
- **Type-Safe:** TS interfaces, strict nulls, explicit returns

## Verification

```bash
pnpm --filter @ragbase/backend test:unit tests/unit/services  # All tests
pnpm --filter @ragbase/backend test:unit tests/unit/services/embedding-service.test.ts  # Specific
pnpm --filter @ragbase/backend test:unit tests/unit/services --watch  # TDD mode
```

## Critical Notes

### LangChain Integration
- `MarkdownTextSplitter` for semantic chunking
- Respects markdown structure, overlap ensures context continuity
- Character positions for source attribution

### Fastembed vs Transformers.js
- Switched from `@xenova/transformers` to `fastembed`
- Faster init, better ONNX runtime, smaller bundle
- Generator-based batch processing for memory efficiency

### Quality Gate Strategy
- Two-tier thresholds (warn vs reject)
- Noise = non-alphanumeric (except whitespace)
- Use case: Filter corrupted PDFs, poor OCR
- Configurable per document type

### Cosine Similarity
- Range: -1 to 1 (1=identical, 0=orthogonal)
- Efficient dot product, handles zero vectors

### Test Strategy
- Mocked embeddings for unit tests (deterministic)
- Real embeddings in integration tests only
- Edge cases: empty, unicode, markdown, code blocks
- Known values: MD5 hashes, 384d vectors

### Performance
- Singleton embedder (init once, reuse)
- Batch processing (50 texts, configurable)
- Generator-based for large batches
- Lazy initialization

### Integration Points
- Hash: Upload route deduplication
- Chunker: After PDF processing
- Embedding: Vector generation for chunks
- Quality gate: Pre-storage validation
