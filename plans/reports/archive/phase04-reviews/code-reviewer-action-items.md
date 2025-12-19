# Phase 04 Code Review - Action Items

**Date:** 2025-12-13
**Priority Order:** CRITICAL → HIGH → MEDIUM → LOW

---

## 🔴 CRITICAL - Fix Before Testing

### 1. Fix Multipart Payload Return Type

**File:** `tests/integration/routes/upload-route.test.ts`
**Line:** 184-195
**Issue:** Helper returns string, not Buffer. Will cause runtime error.

**Current Code:**
```typescript
function createMultipartPayload(filename: string, buffer: Buffer, mimeType: string): string {
  const boundary = '---test';
  const content = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    `Content-Type: ${mimeType}`,
    '',
    buffer.toString('binary'),
    `--${boundary}--`,
  ].join('\r\n');

  return content;  // ❌ Returns string
}
```

**Fix:**
```typescript
function createMultipartPayload(filename: string, buffer: Buffer, mimeType: string): Buffer {
  const boundary = '---test';
  const content = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    `Content-Type: ${mimeType}`,
    '',
    buffer.toString('binary'),
    `--${boundary}--`,
  ].join('\r\n');

  return Buffer.from(content);  // ✅ Returns Buffer
}
```

**Impact:** Tests will fail without this fix
**Effort:** 1 line change

---

### 2. Refactor to Prisma Singleton Pattern

**Files Affected:**
- `apps/backend/src/routes/documents/upload-route.ts` (line 67)
- `apps/backend/src/routes/documents/status-route.ts` (line 20)
- `apps/backend/src/routes/documents/list-route.ts` (line 8)
- `apps/backend/src/routes/query/search-route.ts` (line 26)

**Issue:** Creating new PrismaClient per request is inefficient and memory-intensive. Anti-pattern for production.

**Current Pattern (All Routes):**
```typescript
const prisma = new PrismaClient();
try {
  // ... operations ...
} finally {
  await prisma.$disconnect();
}
```

**Step 1: Create Database Module**
Create `apps/backend/src/database.ts`:
```typescript
import { PrismaClient } from '@prisma/client';

let prismaInstance: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}
```

**Step 2: Update All Routes**
Replace in each route:
```typescript
// OLD
const prisma = new PrismaClient();
try {
  // ...
} finally {
  await prisma.$disconnect();
}

// NEW
const prisma = getPrisma();
// No try-finally needed (singleton handled externally)
```

**Example - Upload Route (upload-route.ts):**
```typescript
import { getPrisma } from '@/database';

export async function uploadRoute(fastify: FastifyInstance): Promise<void> {
  // ... register multipart ...

  fastify.post('/api/documents', async (request, reply) => {
    // ... validation ...

    const prisma = getPrisma();  // Get singleton

    const existing = await prisma.document.findUnique({
      where: { md5Hash },
    });

    if (existing) {
      return reply.status(409).send({...});
    }

    // ... rest of logic, no try-finally needed ...
  });
}
```

**Step 3: Update App Factory**
In `apps/backend/src/app.ts`, add cleanup on shutdown:
```typescript
export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({...});

  // ... existing code ...

  app.addHook('onClose', async () => {
    await disconnectPrisma();
  });

  return app;
}
```

**Impact:**
- Fixes: Memory leaks, connection pooling issues, startup performance
- Affects: All 4 routes
- Effort:** ~30 minutes

---

## 🟠 HIGH - Fix Soon

### 3. Use SafeParse for ListQuerySchema Validation

**File:** `apps/backend/src/routes/documents/list-route.ts`
**Line:** 7
**Issue:** Using `.parse()` throws exception on invalid input instead of returning 400 error.

**Current Code:**
```typescript
const query = ListQuerySchema.parse(request.query);
```

**Fix:**
```typescript
const query = ListQuerySchema.safeParse(request.query);

if (!query.success) {
  return reply.status(400).send({
    error: 'VALIDATION_ERROR',
    message: 'Invalid query parameters',
    details: query.error.errors,
  });
}

const validQuery = query.data;
// Use validQuery in rest of route
```

**Before/After Route:**
```typescript
// BEFORE
export async function listRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/documents', async (request, reply) => {
    const query = ListQuerySchema.parse(request.query);  // ❌ Throws
    const prisma = getPrisma();

    const where = query.status ? { status: query.status } : {};

    // ...
  });
}

// AFTER
export async function listRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/documents', async (request, reply) => {
    const result = ListQuerySchema.safeParse(request.query);

    if (!result.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Invalid query parameters',
      });
    }

    const query = result.data;
    const prisma = getPrisma();

    const where = query.status ? { status: query.status } : {};

    // ... rest unchanged ...
  });
}
```

**Impact:** Proper HTTP 400 responses instead of 500 errors
**Effort:** 10 minutes
**Test Case:** Already exists - should pass after fix

---

### 4. Make Mock Queue Testable

**File:** `apps/backend/src/routes/documents/upload-route.ts`
**Lines:** 12-16
**Issue:** Mock queue cannot be verified in tests; no way to assert job was queued.

**Current Code:**
```typescript
const mockQueue = {
  add: async (name: string, data: any) => {
    console.log(`[Mock Queue] Job added: ${name}`, data);
  },
};
```

**Step 1: Create Queue Abstraction**
Create `apps/backend/src/queue.ts`:
```typescript
export interface Queue {
  add(name: string, data: any): Promise<void>;
}

let queueInstance: Queue | null = null;

export function setQueue(queue: Queue): void {
  queueInstance = queue;
}

export function getQueue(): Queue {
  if (!queueInstance) {
    if (process.env.NODE_ENV === 'test') {
      // Test mode: use mock
      return {
        add: async (name: string, data: any) => {
          console.log(`[Mock Queue] Job added: ${name}`, data);
        },
      };
    }

    // Production: would use real BullMQ (Phase 05)
    throw new Error('Queue not initialized');
  }
  return queueInstance;
}
```

**Step 2: Update Upload Route**
```typescript
import { getQueue } from '@/queue';

export async function uploadRoute(fastify: FastifyInstance): Promise<void> {
  // ...
  fastify.post('/api/documents', async (request, reply) => {
    // ... validation ...

    const queue = getQueue();
    await queue.add('process', {
      documentId: document.id,
      filePath,
      format,
      config: {...},
    });

    return reply.status(201).send({...});
  });
}
```

**Step 3: Update Test Helper**
In `tests/helpers/api.ts`:
```typescript
import { setQueue } from '@/queue';
import { vi } from 'vitest';

export async function createTestApp(): Promise<FastifyInstance> {
  // Mock queue for tests
  const mockQueue = {
    add: vi.fn(async () => {}),
  };
  setQueue(mockQueue);

  const { createApp } = await import('@/app');
  return await createApp();
}
```

**Step 4: Add Test Assertion**
In `tests/integration/routes/upload-route.test.ts`:
```typescript
it('should queue document for processing', async () => {
  const pdfBuffer = await readFixture(FIXTURES.pdf.digital);

  // Get queue instance from test context
  const { mockQueue } = vi.hoisted(() => ({
    mockQueue: { add: vi.fn() },
  }));

  const response = await app.inject({
    method: 'POST',
    url: '/api/documents',
    headers: { 'X-API-Key': API_KEY },
    payload: createMultipartPayload('test.pdf', pdfBuffer, 'application/pdf'),
  });

  expect(response.statusCode).toBe(201);
  expect(mockQueue.add).toHaveBeenCalledWith(
    'process',
    expect.objectContaining({
      documentId: expect.any(String),
      format: 'pdf',
    })
  );
});
```

**Impact:** Enables queue testing, prepares for Phase 05
**Effort:** 45 minutes
**Note:** Phase 05 will replace with real BullMQ

---

## 🟡 MEDIUM - Good to Have

### 5. Extract Embedding String Formatting Helper

**File:** `tests/integration/routes/search-route.test.ts`
**Lines:** 31, 59-60, 89, 112 (repeated pattern)
**Issue:** Verbose and error-prone string formatting repeated 4+ times

**Current Code (Repeated):**
```typescript
const embedding = mockEmbedding('test content');
const embeddingStr = `[${embedding.join(',')}]`;

await prisma.$executeRaw`
  INSERT INTO chunks (...)
  VALUES (..., ${embeddingStr}::vector, ...)
`;
```

**Extract Helper**
Add to `tests/mocks/embedding-mock.ts`:
```typescript
export function embeddingToString(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export function embeddingToVector(embedding: number[]): string {
  return `[${embedding.join(',')}]::vector`;
}
```

**Update Tests:**
```typescript
import { mockEmbedding, embeddingToString } from '@tests/mocks/embedding-mock';

// Usage
const embedding = mockEmbedding('test content');
const embeddingStr = embeddingToString(embedding);

await prisma.$executeRaw`
  INSERT INTO chunks (...)
  VALUES (..., ${embeddingStr}::vector, ...)
`;
```

**Impact:** DRY principle, less error-prone, easier maintenance
**Effort:** 15 minutes

---

### 6. Use Timing-Safe API Key Comparison

**File:** `apps/backend/src/middleware/auth-middleware.ts`
**Line:** 18
**Issue:** String comparison vulnerable to timing attacks (unlikely but best practice)

**Current Code:**
```typescript
if (!apiKey || apiKey !== expectedKey) {
  reply.status(401).send({...});
  return;
}
```

**Fix:**
```typescript
import { timingSafeEqual } from 'crypto';

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (PUBLIC_ROUTES.some(route => request.url.startsWith(route))) {
    return;
  }

  const apiKey = request.headers['x-api-key'];
  const expectedKey = process.env.API_KEY;

  // Timing-safe comparison
  const isValid = apiKey && expectedKey &&
    timingSafeEqual(
      Buffer.from(String(apiKey)),
      Buffer.from(expectedKey)
    ).catch(() => false);

  if (!isValid) {
    reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Invalid or missing API key',
    });
    return;
  }
}
```

**Impact:** Prevents theoretical timing attacks
**Effort:** 10 minutes

---

### 7. Add Missing Test Scenarios

**Add to `auth-middleware.test.ts`:**
```typescript
it('should allow /internal/callback without auth', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/internal/callback',
  });

  // Should not be 401
  expect(response.statusCode).not.toBe(401);
});
```

**Add to `list-route.test.ts`:**
```typescript
it('should cap limit to maximum 100', async () => {
  // Create 150 documents
  for (let i = 0; i < 150; i++) {
    await seedDocument({ md5Hash: `hash${i}` });
  }

  const response = await app.inject({
    method: 'GET',
    url: '/api/documents?limit=500',
    headers: { 'X-API-Key': API_KEY },
  });

  expect(response.json().documents).toHaveLength(100);
});
```

**Add to `search-route.test.ts`:**
```typescript
it('should reject invalid topK values', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/query',
    headers: { 'X-API-Key': API_KEY },
    payload: { query: 'test', topK: 0 },
  });

  expect(response.statusCode).toBe(400);
});
```

**Impact:** Improved test coverage
**Effort:** 30 minutes

---

## 🟢 LOW - Future Enhancement

### 8. Add Database Indexes

**File:** `apps/backend/prisma/schema.prisma`
**Current:** MD5Hash not indexed

**Recommendation:**
```prisma
model Document {
  id       String  @id @default(uuid())
  md5Hash  String  @unique  // Already unique, add index
  // ...
  @@index([status])    // For filtering
  @@index([createdAt]) // For sorting
}

model Chunk {
  id        String  @id @default(uuid())
  embedding Unsupported("vector")  // Already indexed by pgvector
  // ...
  @@index([documentId])  // For FK lookups
}
```

**Benefit:** Faster queries, especially for large datasets
**Effort:** 20 minutes (migration)

---

### 9. Document API Error Codes

**Create:** `docs/API_ERRORS.md`

```markdown
# API Error Codes

## Authentication (401)
- `UNAUTHORIZED` - Missing or invalid X-API-Key header

## File Upload (400, 409)
- `NO_FILE` - No file in multipart payload
- `INVALID_FORMAT` - Unsupported file format
- `FILE_TOO_LARGE` - File exceeds 50MB limit
- `DUPLICATE_FILE` - File already exists (same MD5)

## Status Retrieval (400, 404)
- `INVALID_ID` - Invalid UUID format
- `NOT_FOUND` - Document does not exist

## List Documents (400)
- `VALIDATION_ERROR` - Invalid query parameters

## Search (400)
- `VALIDATION_ERROR` - Invalid search parameters
```

**Benefit:** Clear API documentation, easier client integration
**Effort:** 20 minutes

---

### 10. Add Example Curl Commands

**Create:** `docs/API_EXAMPLES.md`

```bash
# Get API key from .env
API_KEY="your-secret-key"

# Upload document
curl -X POST http://localhost:3000/api/documents \
  -H "X-API-Key: $API_KEY" \
  -F "file=@document.pdf"

# List documents
curl -X GET "http://localhost:3000/api/documents?status=COMPLETED&limit=10" \
  -H "X-API-Key: $API_KEY"

# Get document status
curl -X GET http://localhost:3000/api/documents/{id} \
  -H "X-API-Key: $API_KEY"

# Search documents
curl -X POST http://localhost:3000/api/query \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"machine learning","topK":5}'
```

**Benefit:** Easy manual testing, documentation
**Effort:** 15 minutes

---

## Implementation Checklist

### Before Testing
- [ ] Fix multipart return type (Buffer)
- [ ] Refactor to Prisma singleton
- [ ] Fix ListQuerySchema safeParse

### Before Phase 05
- [ ] Make mock queue testable
- [ ] Extract embedding helper
- [ ] Add timing-safe comparison
- [ ] Add missing test scenarios

### Documentation
- [ ] Create API error documentation
- [ ] Add curl examples
- [ ] Document database indexes

---

## Effort Estimation

| Task | Effort | Priority |
|------|--------|----------|
| Multipart Buffer fix | 5 min | CRITICAL |
| Prisma singleton | 30 min | CRITICAL |
| SafeParse fix | 10 min | HIGH |
| Mock queue testable | 45 min | HIGH |
| Embedding helper | 15 min | MEDIUM |
| Timing-safe API key | 10 min | MEDIUM |
| Missing tests | 30 min | MEDIUM |
| Indexes | 20 min | LOW |
| Error docs | 20 min | LOW |
| Curl examples | 15 min | LOW |

**Total Effort:** ~4 hours for all improvements

---

## Recommended Implementation Order

### Session 1: Critical Fixes (30 min)
1. Fix multipart return type
2. Fix ListQuerySchema safeParse
3. Verify tests run with corrections

### Session 2: Architecture Improvements (45 min)
4. Refactor to Prisma singleton
5. Make mock queue testable
6. Re-test all scenarios

### Session 3: Polish (30 min)
7. Extract embedding helper
8. Add timing-safe comparison
9. Add missing test scenarios

### Session 4: Documentation (30 min)
10. API error documentation
11. Curl examples
12. Database indexes

---

**Review Date:** 2025-12-13
**Status:** Ready for Phase 05 after critical fixes

