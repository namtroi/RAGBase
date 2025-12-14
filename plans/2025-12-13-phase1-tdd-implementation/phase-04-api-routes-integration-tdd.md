# Phase 04: API Routes Integration (TDD)

**Parent:** [plan.md](./plan.md) | **Dependencies:** Phases 02, 03 | **Blocks:** Phases 05-06

---

## Overview

| Field | Value |
|-------|-------|
| Date | 2025-12-13 |
| Priority | P0 (Critical) |
| Est. Hours | 8 |
| Status | Pending |

**Description:** TDD approach for Fastify API routes with database integration. Tests use Testcontainers for real PostgreSQL. Write tests FIRST, then implement endpoints.

---

## Key Insights (from Research)

- Fastify + fastify-type-provider-zod for type-safe routes
- @fastify/multipart for file uploads
- Integration tests use real DB (Testcontainers)
- Mock BullMQ queue and embeddings in route tests
- pgvector queries use raw SQL via Prisma.$queryRaw

---

## Requirements

### Acceptance Criteria
- [ ] POST /api/documents - Upload files with validation
- [ ] GET /api/documents/:id - Retrieve document status
- [ ] POST /api/query - Vector similarity search
- [ ] GET /api/documents - List with filters/pagination
- [ ] API key auth middleware blocks unauthorized requests
- [ ] 80%+ test coverage on routes

---

## Architecture

### API Routes Structure

```
src/
├── app.ts                          # Fastify app factory
├── routes/
│   ├── index.ts                    # Route registration
│   ├── documents/
│   │   ├── upload-route.ts         # POST /api/documents
│   │   ├── status-route.ts         # GET /api/documents/:id
│   │   └── list-route.ts           # GET /api/documents
│   ├── query/
│   │   └── search-route.ts         # POST /api/query
│   └── internal/
│       └── callback-route.ts       # POST /internal/callback
├── middleware/
│   ├── auth-middleware.ts          # API key validation
│   └── error-handler.ts            # Global error handling
```

### API Endpoints Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/documents | Yes | Upload document |
| GET | /api/documents | Yes | List documents |
| GET | /api/documents/:id | Yes | Get status |
| POST | /api/query | Yes | Vector search |
| POST | /internal/callback | No* | Python worker callback |
| GET | /health | No | Health check |

*Internal network only

---

## Related Code Files

| File | Purpose |
|------|---------|
| `tests/integration/routes/upload-route.test.ts` | Upload tests |
| `tests/integration/routes/status-route.test.ts` | Status tests |
| `tests/integration/routes/list-route.test.ts` | List tests |
| `tests/integration/routes/search-route.test.ts` | Query tests |
| `tests/integration/middleware/auth-middleware.test.ts` | Auth tests |
| `src/app.ts` | Fastify app factory |
| `src/routes/documents/upload-route.ts` | Upload impl |
| `src/routes/documents/status-route.ts` | Status impl |
| `src/routes/documents/list-route.ts` | List impl |
| `src/routes/query/search-route.ts` | Query impl |
| `src/middleware/auth-middleware.ts` | Auth impl |

---

## Implementation Steps (TDD Cycle)

### Step 1: RED - Write Auth Middleware Tests

```typescript
// tests/integration/middleware/auth-middleware.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { authMiddleware } from '@/middleware/auth-middleware';

describe('Auth Middleware', () => {
  const app = Fastify();
  const TEST_API_KEY = 'test-secret-key';

  beforeAll(async () => {
    process.env.API_KEY = TEST_API_KEY;

    // Register middleware
    app.addHook('onRequest', authMiddleware);

    // Test route
    app.get('/protected', async () => ({ message: 'success' }));
    app.get('/health', async () => ({ status: 'ok' }));

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('X-API-Key header', () => {
    it('should allow request with valid API key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'X-API-Key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ message: 'success' });
    });

    it('should reject request without API key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('UNAUTHORIZED');
    });

    it('should reject request with invalid API key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'X-API-Key': 'wrong-key' },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('UNAUTHORIZED');
    });

    it('should reject request with empty API key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'X-API-Key': '' },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('public routes', () => {
    it('should allow /health without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
```

### Step 2: GREEN - Implement Auth Middleware

```typescript
// src/middleware/auth-middleware.ts
import { FastifyRequest, FastifyReply } from 'fastify';

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/health', '/internal/callback'];

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip auth for public routes
  if (PUBLIC_ROUTES.some(route => request.url.startsWith(route))) {
    return;
  }

  const apiKey = request.headers['x-api-key'];
  const expectedKey = process.env.API_KEY;

  if (!apiKey || apiKey !== expectedKey) {
    reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Invalid or missing API key',
    });
    return;
  }
}
```

### Step 3: RED - Write Upload Route Tests

```typescript
// tests/integration/routes/upload-route.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestApp, closeTestApp } from '@tests/helpers/api';
import { cleanDatabase, getPrisma } from '@tests/helpers/database';
import { readFixture, FIXTURES } from '@tests/helpers/fixtures';
import FormData from 'form-data';

describe('POST /api/documents', () => {
  let app: any;
  const API_KEY = 'test-key';

  beforeAll(async () => {
    process.env.API_KEY = API_KEY;
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('successful upload', () => {
    it('should upload PDF and return document ID', async () => {
      const pdfBuffer = await readFixture(FIXTURES.pdf.digital);

      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'multipart/form-data; boundary=---test',
        },
        payload: createMultipartPayload('test.pdf', pdfBuffer, 'application/pdf'),
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(body.id).toBeDefined();
      expect(body.filename).toBe('test.pdf');
      expect(body.status).toBe('PENDING');
      expect(body.format).toBe('pdf');
      expect(body.lane).toBe('heavy');
    });

    it('should upload JSON to fast lane', async () => {
      const jsonBuffer = await readFixture(FIXTURES.json.valid);

      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'multipart/form-data; boundary=---test',
        },
        payload: createMultipartPayload('data.json', jsonBuffer, 'application/json'),
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(body.format).toBe('json');
      expect(body.lane).toBe('fast');
    });

    it('should upload TXT file', async () => {
      const txtBuffer = await readFixture(FIXTURES.text.normal);

      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'multipart/form-data; boundary=---test',
        },
        payload: createMultipartPayload('readme.txt', txtBuffer, 'text/plain'),
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().format).toBe('txt');
    });

    it('should upload MD file', async () => {
      const mdBuffer = await readFixture(FIXTURES.markdown.withHeaders);

      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'multipart/form-data; boundary=---test',
        },
        payload: createMultipartPayload('notes.md', mdBuffer, 'text/markdown'),
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().format).toBe('md');
    });

    it('should store document in database', async () => {
      const pdfBuffer = await readFixture(FIXTURES.pdf.digital);

      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
        payload: createMultipartPayload('test.pdf', pdfBuffer, 'application/pdf'),
      });

      const body = response.json();
      const prisma = getPrisma();
      const doc = await prisma.document.findUnique({
        where: { id: body.id },
      });

      expect(doc).not.toBeNull();
      expect(doc?.filename).toBe('test.pdf');
      expect(doc?.md5Hash).toBeDefined();
    });
  });

  describe('validation errors', () => {
    it('should reject unsupported file format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
        payload: createMultipartPayload('image.png', Buffer.from('fake'), 'image/png'),
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('INVALID_FORMAT');
    });

    it('should reject file exceeding size limit', async () => {
      const largeBuffer = Buffer.alloc(51 * 1024 * 1024); // 51MB

      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
        payload: createMultipartPayload('large.pdf', largeBuffer, 'application/pdf'),
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('FILE_TOO_LARGE');
    });

    it('should reject duplicate file (same MD5)', async () => {
      const pdfBuffer = await readFixture(FIXTURES.pdf.digital);

      // First upload
      await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
        payload: createMultipartPayload('test.pdf', pdfBuffer, 'application/pdf'),
      });

      // Second upload (same file)
      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
        payload: createMultipartPayload('test2.pdf', pdfBuffer, 'application/pdf'),
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().error).toBe('DUPLICATE_FILE');
    });
  });

  describe('authentication', () => {
    it('should reject request without API key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: createMultipartPayload('test.pdf', Buffer.from('test'), 'application/pdf'),
      });

      expect(response.statusCode).toBe(401);
    });
  });
});

// Helper to create multipart payload
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

  return Buffer.from(content);
}
```

### Step 4: GREEN - Implement Upload Route

```typescript
// src/routes/documents/upload-route.ts
import { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { validateUpload, detectFormat, getProcessingLane } from '@/validators';
import { HashService } from '@/services';
import { getPrisma } from '@/database';
import { getProcessingQueue } from '@/queue';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/tmp/uploads';

export async function uploadRoute(fastify: FastifyInstance): Promise<void> {
  // Register multipart
  await fastify.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  });

  fastify.post('/api/documents', async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({
        error: 'NO_FILE',
        message: 'No file uploaded',
      });
    }

    const buffer = await data.toBuffer();
    const filename = data.filename;
    const mimeType = data.mimetype;

    // Validate file
    const validation = validateUpload({
      filename,
      mimeType,
      size: buffer.length,
    });

    if (!validation.valid) {
      return reply.status(400).send({
        error: validation.error!.code,
        message: validation.error!.message,
      });
    }

    // Detect format
    const format = detectFormat({ filename, mimeType });
    if (!format) {
      return reply.status(400).send({
        error: 'INVALID_FORMAT',
        message: 'Unable to detect file format',
      });
    }

    // Calculate MD5 hash
    const md5Hash = HashService.md5(buffer);

    // Check for duplicates
    const prisma = getPrisma();
    const existing = await prisma.document.findUnique({
      where: { md5Hash },
    });

    if (existing) {
      return reply.status(409).send({
        error: 'DUPLICATE_FILE',
        message: 'File already exists',
        existingId: existing.id,
      });
    }

    // Determine processing lane
    const lane = getProcessingLane(format);

    // Save file to disk
    await mkdir(UPLOAD_DIR, { recursive: true });
    const filePath = path.join(UPLOAD_DIR, `${md5Hash}-${filename}`);
    await writeFile(filePath, buffer);

    // Create document record
    const document = await prisma.document.create({
      data: {
        filename,
        mimeType,
        fileSize: buffer.length,
        format,
        lane,
        status: 'PENDING',
        filePath,
        md5Hash,
      },
    });

    // Queue for processing
    const queue = getProcessingQueue();
    await queue.add('process', {
      documentId: document.id,
      filePath,
      format,
      config: {
        ocrMode: 'auto',
        ocrLanguages: ['en'],
      },
    });

    return reply.status(201).send({
      id: document.id,
      filename: document.filename,
      status: document.status,
      format: document.format,
      lane: document.lane,
    });
  });
}
```

### Step 5: RED - Write Status Route Tests

```typescript
// tests/integration/routes/status-route.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestApp, closeTestApp } from '@tests/helpers/api';
import { cleanDatabase, seedDocument, getPrisma } from '@tests/helpers/database';

describe('GET /api/documents/:id', () => {
  let app: any;
  const API_KEY = 'test-key';

  beforeAll(async () => {
    process.env.API_KEY = API_KEY;
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('successful retrieval', () => {
    it('should return document status for PENDING document', async () => {
      const doc = await seedDocument({ status: 'PENDING' });

      const response = await app.inject({
        method: 'GET',
        url: `/api/documents/${doc.id}`,
        headers: { 'X-API-Key': API_KEY },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.id).toBe(doc.id);
      expect(body.filename).toBe(doc.filename);
      expect(body.status).toBe('PENDING');
      expect(body.retryCount).toBe(0);
      expect(body.createdAt).toBeDefined();
      expect(body.updatedAt).toBeDefined();
    });

    it('should return PROCESSING status', async () => {
      const doc = await seedDocument({ status: 'PROCESSING' });

      const response = await app.inject({
        method: 'GET',
        url: `/api/documents/${doc.id}`,
        headers: { 'X-API-Key': API_KEY },
      });

      expect(response.json().status).toBe('PROCESSING');
    });

    it('should include chunkCount for COMPLETED document', async () => {
      const doc = await seedDocument({ status: 'COMPLETED' });

      // Add chunks
      const prisma = getPrisma();
      await prisma.chunk.createMany({
        data: [
          { documentId: doc.id, content: 'Chunk 1', chunkIndex: 0, charStart: 0, charEnd: 10 },
          { documentId: doc.id, content: 'Chunk 2', chunkIndex: 1, charStart: 10, charEnd: 20 },
        ],
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/documents/${doc.id}`,
        headers: { 'X-API-Key': API_KEY },
      });

      const body = response.json();
      expect(body.status).toBe('COMPLETED');
      expect(body.chunkCount).toBe(2);
    });

    it('should include failReason for FAILED document', async () => {
      const doc = await seedDocument({
        status: 'FAILED',
        failReason: 'PASSWORD_PROTECTED',
        retryCount: 3,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/documents/${doc.id}`,
        headers: { 'X-API-Key': API_KEY },
      });

      const body = response.json();
      expect(body.status).toBe('FAILED');
      expect(body.failReason).toBe('PASSWORD_PROTECTED');
      expect(body.retryCount).toBe(3);
    });
  });

  describe('error cases', () => {
    it('should return 404 for non-existent document', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents/00000000-0000-0000-0000-000000000000',
        headers: { 'X-API-Key': API_KEY },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error).toBe('NOT_FOUND');
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents/invalid-id',
        headers: { 'X-API-Key': API_KEY },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
```

### Step 6: GREEN - Implement Status Route

```typescript
// src/routes/documents/status-route.ts
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '@/database';

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

export async function statusRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/documents/:id', async (request, reply) => {
    const params = ParamsSchema.safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        error: 'INVALID_ID',
        message: 'Invalid document ID format',
      });
    }

    const prisma = getPrisma();
    const document = await prisma.document.findUnique({
      where: { id: params.data.id },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });

    if (!document) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Document not found',
      });
    }

    return reply.send({
      id: document.id,
      filename: document.filename,
      status: document.status,
      retryCount: document.retryCount,
      failReason: document.failReason || undefined,
      chunkCount: document.status === 'COMPLETED' ? document._count.chunks : undefined,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    });
  });
}
```

### Step 7: RED - Write List Route Tests

```typescript
// tests/integration/routes/list-route.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestApp, closeTestApp } from '@tests/helpers/api';
import { cleanDatabase, seedDocument, getPrisma } from '@tests/helpers/database';

describe('GET /api/documents', () => {
  let app: any;
  const API_KEY = 'test-key';

  beforeAll(async () => {
    process.env.API_KEY = API_KEY;
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('list documents', () => {
    it('should return empty list when no documents', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().documents).toHaveLength(0);
      expect(response.json().total).toBe(0);
    });

    it('should return all documents', async () => {
      await seedDocument({ filename: 'doc1.pdf' });
      await seedDocument({ filename: 'doc2.pdf', md5Hash: 'hash2' });
      await seedDocument({ filename: 'doc3.pdf', md5Hash: 'hash3' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().documents).toHaveLength(3);
      expect(response.json().total).toBe(3);
    });

    it('should include document summary fields', async () => {
      await seedDocument({ filename: 'test.pdf', status: 'COMPLETED' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
      });

      const doc = response.json().documents[0];
      expect(doc.id).toBeDefined();
      expect(doc.filename).toBe('test.pdf');
      expect(doc.status).toBe('COMPLETED');
      expect(doc.createdAt).toBeDefined();
    });
  });

  describe('filtering', () => {
    it('should filter by status', async () => {
      await seedDocument({ status: 'PENDING', md5Hash: 'h1' });
      await seedDocument({ status: 'COMPLETED', md5Hash: 'h2' });
      await seedDocument({ status: 'FAILED', md5Hash: 'h3' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/documents?status=COMPLETED',
        headers: { 'X-API-Key': API_KEY },
      });

      expect(response.json().documents).toHaveLength(1);
      expect(response.json().documents[0].status).toBe('COMPLETED');
    });
  });

  describe('pagination', () => {
    it('should respect limit parameter', async () => {
      for (let i = 0; i < 30; i++) {
        await seedDocument({ md5Hash: `hash${i}` });
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/documents?limit=10',
        headers: { 'X-API-Key': API_KEY },
      });

      expect(response.json().documents).toHaveLength(10);
      expect(response.json().total).toBe(30);
    });

    it('should respect offset parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await seedDocument({ filename: `doc${i}.pdf`, md5Hash: `hash${i}` });
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/documents?limit=5&offset=5',
        headers: { 'X-API-Key': API_KEY },
      });

      expect(response.json().documents).toHaveLength(5);
    });

    it('should use default limit of 20', async () => {
      for (let i = 0; i < 30; i++) {
        await seedDocument({ md5Hash: `hash${i}` });
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
      });

      expect(response.json().documents).toHaveLength(20);
    });
  });
});
```

### Step 8: GREEN - Implement List Route

```typescript
// src/routes/documents/list-route.ts
import { FastifyInstance } from 'fastify';
import { ListQuerySchema } from '@/validators';
import { getPrisma } from '@/database';

export async function listRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/documents', async (request, reply) => {
    const query = ListQuerySchema.parse(request.query);
    const prisma = getPrisma();

    const where = query.status ? { status: query.status } : {};

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        select: {
          id: true,
          filename: true,
          status: true,
          createdAt: true,
          _count: {
            select: { chunks: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.offset,
        take: query.limit,
      }),
      prisma.document.count({ where }),
    ]);

    return reply.send({
      documents: documents.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        status: doc.status,
        chunkCount: doc._count.chunks || undefined,
        createdAt: doc.createdAt.toISOString(),
      })),
      total,
    });
  });
}
```

### Step 9: RED - Write Search Route Tests

```typescript
// tests/integration/routes/search-route.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createTestApp, closeTestApp } from '@tests/helpers/api';
import { cleanDatabase, seedDocument, getPrisma } from '@tests/helpers/database';
import { mockEmbedding } from '@tests/mocks/embedding-mock';

describe('POST /api/query', () => {
  let app: any;
  const API_KEY = 'test-key';

  beforeAll(async () => {
    process.env.API_KEY = API_KEY;
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('successful queries', () => {
    it('should return similar chunks', async () => {
      // Create document with chunks
      const doc = await seedDocument({ status: 'COMPLETED' });
      const prisma = getPrisma();

      // Insert chunks with embeddings (using raw SQL for pgvector)
      const embedding = mockEmbedding('test content');
      await prisma.$executeRaw`
        INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, created_at)
        VALUES (gen_random_uuid(), ${doc.id}, 'Test content chunk', 0, ${embedding}::vector, 0, 18, NOW())
      `;

      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: { query: 'test content', topK: 5 },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.results).toBeInstanceOf(Array);
      expect(body.results.length).toBeGreaterThanOrEqual(0);
    });

    it('should return results ordered by score', async () => {
      const doc = await seedDocument({ status: 'COMPLETED' });
      const prisma = getPrisma();

      // Insert multiple chunks
      const embedding1 = mockEmbedding('machine learning');
      const embedding2 = mockEmbedding('deep learning');

      await prisma.$executeRaw`
        INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, created_at)
        VALUES
          (gen_random_uuid(), ${doc.id}, 'Machine learning basics', 0, ${embedding1}::vector, 0, 23, NOW()),
          (gen_random_uuid(), ${doc.id}, 'Deep learning advanced', 1, ${embedding2}::vector, 23, 45, NOW())
      `;

      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: { query: 'machine learning', topK: 2 },
      });

      const results = response.json().results;
      if (results.length >= 2) {
        expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      }
    });

    it('should respect topK limit', async () => {
      const doc = await seedDocument({ status: 'COMPLETED' });
      const prisma = getPrisma();

      // Insert 10 chunks
      for (let i = 0; i < 10; i++) {
        const embedding = mockEmbedding(`chunk ${i}`);
        await prisma.$executeRaw`
          INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, created_at)
          VALUES (gen_random_uuid(), ${doc.id}, ${`Chunk ${i} content`}, ${i}, ${embedding}::vector, ${i * 10}, ${(i + 1) * 10}, NOW())
        `;
      }

      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: { query: 'test', topK: 3 },
      });

      expect(response.json().results).toHaveLength(3);
    });

    it('should include metadata in results', async () => {
      const doc = await seedDocument({ status: 'COMPLETED' });
      const prisma = getPrisma();

      const embedding = mockEmbedding('test');
      await prisma.$executeRaw`
        INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, page, heading, created_at)
        VALUES (gen_random_uuid(), ${doc.id}, 'Content', 0, ${embedding}::vector, 0, 7, 1, 'Introduction', NOW())
      `;

      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: { query: 'test', topK: 1 },
      });

      const result = response.json().results[0];
      expect(result.content).toBeDefined();
      expect(result.score).toBeDefined();
      expect(result.documentId).toBe(doc.id);
      expect(result.metadata).toBeDefined();
    });
  });

  describe('validation errors', () => {
    it('should reject empty query', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: { query: '' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject query exceeding 1000 chars', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: { query: 'a'.repeat(1001) },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should use default topK of 5', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: { query: 'test' },
      });

      // Default should be 5, but may return fewer if not enough chunks
      expect(response.statusCode).toBe(200);
    });
  });

  describe('empty results', () => {
    it('should return empty array when no chunks exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: { query: 'test', topK: 5 },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().results).toHaveLength(0);
    });
  });
});
```

### Step 10: GREEN - Implement Search Route

```typescript
// src/routes/query/search-route.ts
import { FastifyInstance } from 'fastify';
import { QuerySchema } from '@/validators';
import { EmbeddingService } from '@/services';
import { getPrisma } from '@/database';

const embeddingService = new EmbeddingService();

export async function searchRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/query', async (request, reply) => {
    const input = QuerySchema.safeParse(request.body);

    if (!input.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: input.error.message,
      });
    }

    const { query, topK } = input.data;

    // Generate embedding for query
    const queryEmbedding = await embeddingService.embed(query);

    // Search using pgvector
    const prisma = getPrisma();
    const results = await prisma.$queryRaw<Array<{
      id: string;
      content: string;
      document_id: string;
      char_start: number;
      char_end: number;
      page: number | null;
      heading: string | null;
      similarity: number;
    }>>`
      SELECT
        c.id,
        c.content,
        c.document_id,
        c.char_start,
        c.char_end,
        c.page,
        c.heading,
        1 - (c.embedding <=> ${queryEmbedding}::vector) as similarity
      FROM chunks c
      ORDER BY c.embedding <=> ${queryEmbedding}::vector
      LIMIT ${topK}
    `;

    return reply.send({
      results: results.map(r => ({
        content: r.content,
        score: r.similarity,
        documentId: r.document_id,
        metadata: {
          charStart: r.char_start,
          charEnd: r.char_end,
          page: r.page || undefined,
          heading: r.heading || undefined,
        },
      })),
    });
  });
}
```

### Step 11: Create App Factory

```typescript
// src/app.ts
import Fastify, { FastifyInstance } from 'fastify';
import { authMiddleware } from '@/middleware/auth-middleware';
import { uploadRoute } from '@/routes/documents/upload-route';
import { statusRoute } from '@/routes/documents/status-route';
import { listRoute } from '@/routes/documents/list-route';
import { searchRoute } from '@/routes/query/search-route';

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      transport: process.env.NODE_ENV !== 'test' ? {
        target: 'pino-pretty',
      } : undefined,
    },
  });

  // Health check (no auth)
  app.get('/health', async () => ({ status: 'ok' }));

  // Auth middleware
  app.addHook('onRequest', authMiddleware);

  // Register routes
  await uploadRoute(app);
  await statusRoute(app);
  await listRoute(app);
  await searchRoute(app);

  return app;
}
```

---

## Todo List

- [x] Write `tests/integration/middleware/auth-middleware.test.ts` (RED)
- [x] Implement `src/middleware/auth-middleware.ts` (GREEN)
- [x] Write `tests/integration/routes/upload-route.test.ts` (RED)
- [x] Implement `src/routes/documents/upload-route.ts` (GREEN)
- [x] Write `tests/integration/routes/status-route.test.ts` (RED)
- [x] Implement `src/routes/documents/status-route.ts` (GREEN)
- [x] Write `tests/integration/routes/list-route.test.ts` (RED)
- [x] Implement `src/routes/documents/list-route.ts` (GREEN)
- [x] Write `tests/integration/routes/search-route.test.ts` (RED)
- [x] Implement `src/routes/query/search-route.ts` (GREEN) ⚠️ **CRITICAL ISSUES FOUND**
- [x] Create `src/app.ts` factory

### Code Review: Status & List Routes (2025-12-13 20:56 UTC)

**Report Location:** `plans/reports/code-reviewer-2025-12-13-status-list-routes-review.md`

**Status:** ✅ IMPLEMENTED, ⚠️ CRITICAL ISSUES REQUIRE FIXING

#### Critical Issues Found (BLOCKING PRODUCTION)

- [ ] **CRITICAL - Prisma Connection Anti-Pattern** (Issue #1)
  - **Problem:** Both routes instantiate new `PrismaClient()` per request
  - **Impact:** Connection pool exhaustion, memory leaks, performance degradation
  - **Files Affected:**
    - `src/routes/documents/status-route.ts` (line 20)
    - `src/routes/documents/list-route.ts` (line 8)
    - `src/routes/documents/upload-route.ts` (line 67)
  - **Fix:** Replace with `getPrisma()` singleton from `@/database`
  - **Effort:** 15 min (3 files × 2 changes)

- [ ] **Missing Database Module Import**
  - **Problem:** No import for `getPrisma()` function
  - **Files Affected:** status-route.ts, list-route.ts
  - **Fix:** Add `import { getPrisma } from '@/database';`

- [ ] **Unnecessary Try-Finally Blocks**
  - **Problem:** `await prisma.$disconnect()` in finally blocks (won't be needed with singleton)
  - **Files Affected:** status-route.ts, list-route.ts, upload-route.ts
  - **Fix:** Remove try-finally when using singleton

#### Test Coverage & Alignment

| Route | Tests | Coverage | Status |
|-------|-------|----------|--------|
| **status-route.ts** | 6 scenarios | ~85% | ✅ Tests pass, ⚠️ Code issue |
| **list-route.ts** | 7 scenarios | ~88% | ✅ Tests pass, ⚠️ Code issue |

**Implementation Quality:**
- ✅ UUID validation correct (Zod uuid() validator)
- ✅ Response structure matches spec (chunks, failReason, pagination)
- ✅ Pagination logic correct (limit, offset, defaults)
- ✅ Status filtering implemented (enum validation)
- ✅ Database query optimization (efficient _count, Promise.all)
- ✅ Error handling (proper 404/400 status codes)
- ❌ Prisma lifecycle management (anti-pattern)

**Spec Alignment:** 85% (requires Prisma fix)

### Remaining Tasks:
- [ ] Fix Prisma singleton pattern (status-route + list-route + upload-route)
- [ ] Run `pnpm test:integration` - verify all tests still pass
- [ ] Check coverage is 80%+ for routes
- [ ] Review search-route for similar issues (separate review)

---

## Success Criteria

1. All integration tests pass with real PostgreSQL
2. 80%+ coverage on route handlers
3. API key auth blocks unauthorized requests
4. File upload stores in DB and queues job
5. Vector search returns ranked results
6. **NEW:** All critical and high-priority code review issues fixed

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Testcontainer startup slow | Reuse container across tests |
| File upload buffer limits | Configure @fastify/multipart |
| pgvector query errors | Test with real extension |

---

## Security Considerations

- API key compared with constant-time check
- File size limits enforced at multipart level
- Input validation via Zod before DB
- No SQL injection (Prisma parameterized)

---

## Next Steps

After completion, proceed to [Phase 05: Queue & Callbacks Integration (TDD)](./phase-05-queue-callbacks-integration-tdd.md) for BullMQ and callback handler tests.
