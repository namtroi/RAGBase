# RAGBase Test Strategy

**TDD approach for Phase 1.**

---

## 1. Test Pyramid

```
        ┌─────────┐
        │   E2E   │  ← 10% (happy paths only)
        ├─────────┤
        │  Integ  │  ← 30% (service boundaries)
        ├─────────┤
        │  Unit   │  ← 60% (business logic)
        └─────────┘
```

| Layer | Scope | Runner | DB |
|-------|-------|--------|-----|
| Unit | Pure functions, validators | Vitest | None |
| Integration | API routes, DB, Queue | Vitest | Testcontainers |
| E2E | Full pipeline | Vitest + Supertest | Testcontainers |

---

## 2. Test Boundaries

### Unit Tests (Fast, No I/O)

```typescript
// ✅ Test these
- Zod validation schemas
- File format detection
- Chunk splitting logic
- Noise ratio calculation
- Query result ranking

// ❌ Mock these
- Database calls
- Redis/BullMQ
- File system
- Python worker
- Embedding API
```

### Integration Tests (Real DB, Mocked External)

```typescript
// ✅ Test these
- API endpoints → Database
- Queue job creation
- Document status transitions
- Query with pgvector

// ❌ Mock these  
- Python worker (HTTP stub)
- Embedding generation
```

### E2E Tests (Full Pipeline)

```typescript
// ✅ Test these
- Upload PDF → Queue → Callback → Chunks → Query
- Fast lane: JSON/TXT direct processing

// ⚠️ Optional
- Real Docling (slow, CI only)
```

---

## 3. Mock Strategy

### Python Worker Mock

```typescript
// Stub HTTP server for /internal/callback
const mockWorker = {
  // Simulate successful processing
  success: (docId: string) => ({
    documentId: docId,
    success: true,
    result: {
      markdown: '# Test\n\nContent here.',
      pageCount: 1,
      ocrApplied: false,
      processingTimeMs: 150,
    },
  }),

  // Simulate failure
  failure: (docId: string, code: ErrorCode) => ({
    documentId: docId,
    success: false,
    error: { code, message: `Mocked ${code}` },
  }),
};
```

### Embedding Mock

```typescript
// Return deterministic vectors for testing
function mockEmbedding(text: string): number[] {
  // Hash text → consistent 384d vector
  const seed = hashCode(text);
  return Array(384).fill(0).map((_, i) => 
    Math.sin(seed + i) * 0.5
  );
}
```

### BullMQ Mock

```typescript
// In-memory queue for unit tests
class MockQueue {
  jobs: Map<string, Job> = new Map();
  
  async add(name: string, data: ProcessingJob) {
    const id = randomUUID();
    this.jobs.set(id, { id, name, data, status: 'waiting' });
    return { id };
  }
}
```

---

## 4. Test Fixtures

### Directory Structure

```
tests/
├── fixtures/
│   ├── pdfs/
│   │   ├── simple-digital.pdf      # 1 page, text only
│   │   ├── multi-page.pdf          # 5 pages
│   │   ├── password-protected.pdf  # Should reject
│   │   ├── scanned-image.pdf       # Needs OCR
│   │   └── corrupt.pdf             # Invalid file
│   ├── expected/
│   │   ├── simple-digital.md       # Expected output
│   │   └── multi-page.md
│   ├── json/
│   │   ├── valid.json
│   │   └── malformed.json
│   └── text/
│       ├── normal.txt
│       └── unicode.txt
```

### Fixture Helpers

```typescript
import { readFixture, getExpected } from './helpers';

// Load test file
const pdf = await readFixture('pdfs/simple-digital.pdf');

// Compare with expected
const expected = await getExpected('simple-digital.md');
expect(result.markdown).toBe(expected);
```

---

## 5. Test Categories

### A. Validation Tests

```typescript
describe('UploadSchema', () => {
  it('rejects files > 50MB');
  it('rejects unsupported formats');
  it('accepts valid PDF');
  it('defaults ocrMode to auto');
});

describe('QuerySchema', () => {
  it('rejects empty query');
  it('rejects query > 1000 chars');
  it('defaults topK to 5');
  it('clamps topK to 100');
});
```

### B. Processing Tests

```typescript
describe('FileRouter', () => {
  it('routes PDF to heavy lane');
  it('routes JSON to fast lane');
  it('detects format from mime type');
});

describe('Chunker', () => {
  it('splits at 1000 chars');
  it('maintains 200 char overlap');
  it('preserves markdown structure');
  it('handles empty content');
});

describe('QualityGate', () => {
  it('rejects text < 50 chars');
  it('warns on noise > 50%');
  it('rejects noise > 80%');
});
```

### C. API Tests

```typescript
describe('POST /api/documents', () => {
  it('returns 201 with document ID');
  it('returns 400 for invalid file');
  it('returns 401 without auth');
  it('queues job in BullMQ');
});

describe('GET /api/documents/:id', () => {
  it('returns document status');
  it('returns 404 for unknown ID');
  it('includes chunk count when completed');
});

describe('POST /api/query', () => {
  it('returns similar chunks');
  it('orders by score descending');
  it('respects topK limit');
  it('returns empty array for no matches');
});
```

### D. Integration Tests

```typescript
describe('Processing Pipeline', () => {
  it('processes fast-lane file directly');
  it('queues heavy-lane file');
  it('handles callback success');
  it('handles callback failure');
  it('retries failed jobs 3x');
  it('moves to DLQ after retries');
});

describe('Vector Search', () => {
  it('stores embeddings in pgvector');
  it('retrieves by cosine similarity');
  it('filters by document ID');
});
```

---

## 6. Setup & Teardown

### Database (Testcontainers)

```typescript
import { PostgreSqlContainer } from '@testcontainers/postgresql';

let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;

beforeAll(async () => {
  container = await new PostgreSqlContainer()
    .withDatabase('test')
    .start();
  
  process.env.DATABASE_URL = container.getConnectionUri();
  prisma = new PrismaClient();
  await prisma.$executeRaw`CREATE EXTENSION vector`;
});

afterAll(async () => {
  await prisma.$disconnect();
  await container.stop();
});

beforeEach(async () => {
  // Clean tables between tests
  await prisma.chunk.deleteMany();
  await prisma.document.deleteMany();
});
```

### Redis (Testcontainers)

```typescript
import { RedisContainer } from '@testcontainers/redis';

let redis: StartedRedisContainer;

beforeAll(async () => {
  redis = await new RedisContainer().start();
  process.env.REDIS_URL = redis.getConnectionUrl();
});
```

---

## 7. Coverage Requirements

| Area | Target | Rationale |
|------|--------|-----------|
| Validation | 100% | Critical path |
| Business logic | 90% | Core functionality |
| API routes | 80% | Happy + error paths |
| Utils | 70% | Edge cases optional |

### Enforce in CI

```json
// vitest.config.ts
{
  "coverage": {
    "statements": 80,
    "branches": 75,
    "functions": 80,
    "lines": 80
  }
}
```

---

## 8. CI Pipeline

```yaml
# .github/workflows/test.yml
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm test:unit
  
  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
      redis:
        image: redis:7-alpine
    steps:
      - run: pnpm test:integration
  
  e2e:
    runs-on: ubuntu-latest
    steps:
      - run: docker compose -f docker-compose.test.yml up -d
      - run: pnpm test:e2e
```

---

## 9. Test Commands

```bash
# Unit tests (fast, no deps)
pnpm test:unit

# Integration (needs Docker)
pnpm test:integration

# E2E (full stack)
pnpm test:e2e

# All tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

---

## 10. TDD Workflow

```
1. Write failing test       ← RED
2. Implement minimum code   ← GREEN  
3. Refactor                 ← REFACTOR
4. Repeat
```

### Example: New Feature

```typescript
// Step 1: Write test first
it('should detect password-protected PDF', async () => {
  const pdf = await readFixture('pdfs/password-protected.pdf');
  const result = await processor.analyze(pdf);
  expect(result.isPasswordProtected).toBe(true);
});

// Step 2: Implement
async function analyze(buffer: Buffer) {
  // ... implementation
}

// Step 3: Refactor if needed
```
