# Fast Lane Processing - Quick Reference

**Status:** COMPLETED - Task 1.3
**Test Coverage:** 17/17 E2E tests passing (100%)

---

## One-Minute Overview

**What:** Immediate processing of JSON/TXT/MD files without queue delays
**Why:** Reduce latency from minutes (heavy lane) to seconds (fast lane)
**How:** Chunk → Embed → Store (all synchronously in POST handler)
**Result:** Document status COMPLETED with searchable chunks ready

---

## Processing Pipeline

```
POST /api/documents
  ↓
Validate → Detect Format → Save File → Create Record
  ↓
Is it JSON/TXT/MD?
  ├─ YES → FAST LANE (this task)
  │  ├─ Read content
  │  ├─ Chunk with LangChain
  │  ├─ Embed with fastembed
  │  ├─ Insert to PostgreSQL
  │  └─ Status: COMPLETED
  │
  └─ NO (PDF/DOCX) → HEAVY LANE
     ├─ Queue to BullMQ
     └─ Status: PENDING
```

---

## Key Files

| File | Purpose | Key Code |
|------|---------|----------|
| `apps/backend/src/routes/documents/upload-route.ts` | Request handler + fast lane logic | Lines 155-214 |
| `apps/backend/src/services/chunker-service.ts` | Text splitting | `ChunkerService.chunk()` |
| `apps/backend/src/services/embedding-service.ts` | Vector generation | `EmbeddingService.embedBatch()` |
| `tests/e2e/pipeline/error-handling.test.ts` | E2E tests | Quality gate tests |

---

## Configuration

```typescript
// Chunking (LangChain)
const chunker = new ChunkerService();
// Default: 1000-char chunks, 200-char overlap

// Embedding (fastembed)
const embedder = new EmbeddingService();
// Model: sentence-transformers/all-MiniLM-L6-v2 (384-dim)
// Batch size: 50

// Quality Gate (before chunking)
// MIN_TEXT_LENGTH: 50 chars
// MAX_NOISE_RATIO: 80% (special chars)
```

---

## Error Codes

| Condition | Status | Code | Example |
|-----------|--------|------|---------|
| Invalid JSON | 400 | INVALID_FORMAT | "Not valid JSON" |
| Text too short | 400/FAILED | TEXT_TOO_SHORT | "< 50 chars" |
| Excessive noise | 400/FAILED | EXCESSIVE_NOISE | "> 80% symbols" |
| File too large | 413 | INTERNAL_ERROR | "> 50MB" |
| Processing error | 500/FAILED | Processing failed | "Chunking error" |

---

## Performance

| Operation | Time | Scale |
|-----------|------|-------|
| File read (1MB) | ~10ms | Disk I/O dependent |
| Chunking (1MB) | ~50ms | Linear growth |
| Embedding (50 chunks) | ~500ms | ~10ms per chunk |
| DB insert (50 chunks) | ~100ms | Batch operation |
| **Total (1MB)** | **~660ms** | Sub-second |

---

## Database Schema

```sql
CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id),
  content TEXT,
  chunk_index INT,
  embedding vector(384),  -- pgvector type
  char_start INT,
  char_end INT,
  heading TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Examples

### Upload & Process (Fast Lane)

```bash
# Request
curl -X POST http://localhost:3000/api/documents \
  -H "X-API-Key: your-key" \
  -F "file=@document.json"

# Response (201)
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "document.json",
  "status": "COMPLETED",  ← Immediate!
  "format": "json",
  "lane": "fast"
}
```

### Check Chunks

```bash
# Verify chunks were created
SELECT COUNT(*) FROM chunks
WHERE document_id = '550e8400-e29b-41d4-a716-446655440000';
# Result: 5 (for example)
```

---

## Integration Points

**Chunk Query (Search)**
```typescript
// In search-route.ts (Phase 04+)
const results = await prisma.$queryRaw`
  SELECT ... FROM chunks c
  ORDER BY c.embedding <=> ${embedding}::vector
  LIMIT ${topK}
`;
```

**Status Check**
```typescript
// GET /api/documents/{id}
// Returns chunkCount when COMPLETED
```

---

## Quality Gates

**Before Chunking:**
1. Text length ≥ 50 characters
2. Noise ratio ≤ 80% (special char ratio)

**Failure Examples:**
- Empty file → TEXT_TOO_SHORT
- `!@#$%^&*(...)` → EXCESSIVE_NOISE
- `{broken: json}` → INVALID_JSON (JSON format)

---

## Testing

**What's Tested:**
- Quality gate rejection (too short, too noisy)
- File size limit enforcement
- Format validation
- Duplicate detection

**What's Not Tested:**
- Actual chunk output (integration tested)
- Embedding generation (unit tested separately)
- Database constraints (schema validated)

**Run E2E:**
```bash
pnpm test:e2e
# Expected: 17 tests passing
```

---

## Common Questions

**Q: Why not use OpenAI embeddings?**
A: Self-hosted fastembed has no API latency/cost/rate limits.

**Q: Why raw SQL instead of Prisma ORM?**
A: Prisma doesn't support pgvector type directly. Raw SQL with template literals is safe.

**Q: Why overlap chunks by 200 chars?**
A: Preserves context across boundaries for semantic search.

**Q: What happens if embedding fails?**
A: Document marked FAILED, failReason logged, response is 500 to client.

**Q: Can I configure chunk size?**
A: Yes: `new ChunkerService({ chunkSize: 2000, chunkOverlap: 400 })`

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| "pgvector not installed" | Extension missing | `CREATE EXTENSION vector;` |
| "Embedding model download failed" | Network/disk space | Check internet, free up disk |
| "Document status is PENDING" | Still processing | Wait or check logs |
| "No chunks found" | Insert failed silently | Check PostgreSQL error logs |

---

## Next: Phase 05+

**What comes next:**
- Queue integration (BullMQ) for fast lane
- Async processing while returning 202 Accepted
- Heavy lane queue for PDF/DOCX processing
- Python worker integration

**This foundation enables:**
- Immediate semantic search on simple files
- Scalable heavy processing with queue
- Unified chunking/embedding pipeline

---

## Documentation Links

- **Full Guide:** `FAST_LANE_PROCESSING.md`
- **Codebase Overview:** `codebase-summary.md` (sections 2.3-2.5, 4.1)
- **Architecture:** `ARCHITECTURE.md` (section 2: Embedding Pipeline)
- **Tests:** `TEST_STRATEGY.md` (Phase 06 section)

---

**Last Updated:** 2025-12-14 (Task 1.3)
**Tests:** 17/17 passing
**Status:** Ready for Phase 05
