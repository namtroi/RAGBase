# Phase 06: E2E Pipeline (TDD)

**Parent:** [plan.md](./plan.md) | **Dependencies:** Phases 00-05 | **Blocks:** None

---

## Overview

| Field | Value |
|-------|-------|
| Date | 2025-12-13 |
| Priority | P0 (Critical) |
| Est. Hours | 6 |
| Status | Pending |

**Description:** End-to-end tests validating complete pipeline from upload to query. Uses mocked Python worker for heavy lane, real processing for fast lane.

---

## Key Insights (from Research)

- E2E tests should cover happy paths only (10% of test pyramid)
- Mock Python worker with HTTP stub for predictable results
- Full Docker stack for realistic integration
- Test timeout needs to be generous (60s+)

---

## Requirements

### Acceptance Criteria
- [ ] E2E: Upload PDF → Queue → Mock callback → Chunks → Query works
- [ ] E2E: Upload JSON (fast lane) → Direct processing → Query works
- [ ] E2E: Password-protected PDF rejected with correct error
- [ ] E2E: Quality gate rejection for low text/high noise
- [ ] E2E: Duplicate file detection works
- [ ] All E2E tests use real PostgreSQL + Redis

---

## Architecture

### E2E Test Flow

```
┌─────────────────────────────────────────────────────────┐
│                    E2E Test Environment                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────┐    ┌──────────────┐    ┌────────────────┐  │
│  │  Test   │───►│ Fastify App  │───►│  PostgreSQL    │  │
│  │  Code   │    │   (Real)     │    │ (Testcontainer)│  │
│  └─────────┘    └──────────────┘    └────────────────┘  │
│       │                 │                               │
│       │                 ▼                               │
│       │         ┌──────────────┐    ┌────────────────┐  │
│       │         │    BullMQ    │───►│     Redis      │  │
│       │         │   (Real)     │    │ (Testcontainer)│  │
│       │         └──────────────┘    └────────────────┘  │
│       │                 │                               │
│       │                 ▼                               │
│       │         ┌──────────────┐                        │
│       └────────►│ Mock Python  │ (HTTP stub)            │
│                 │   Callback   │                        │
│                 └──────────────┘                        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Related Code Files

| File | Purpose |
|------|---------|
| `tests/e2e/pipeline/pdf-upload-flow.test.ts` | PDF E2E test |
| `tests/e2e/pipeline/json-fast-lane.test.ts` | JSON E2E test |
| `tests/e2e/pipeline/error-handling.test.ts` | Error scenarios |
| `tests/e2e/pipeline/query-flow.test.ts` | Query E2E test |
| `tests/e2e/setup/e2e-setup.ts` | E2E environment setup |

---

## Implementation Steps (TDD Cycle)

### Step 1: E2E Environment Setup

```typescript
// tests/e2e/setup/e2e-setup.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import { createApp } from '@/app';
import { getPrisma, initPrisma } from '@/database';
import { createProcessingQueue, closeQueue } from '@/queue/processing-queue';
import type { FastifyInstance } from 'fastify';

let postgresContainer: any;
let redisContainer: any;
let app: FastifyInstance;

export async function setupE2E() {
  // Start containers
  [postgresContainer, redisContainer] = await Promise.all([
    new PostgreSqlContainer('pgvector/pgvector:pg16')
      .withDatabase('test')
      .start(),
    new RedisContainer('redis:7-alpine').start(),
  ]);

  // Set environment
  process.env.DATABASE_URL = postgresContainer.getConnectionUri();
  process.env.REDIS_URL = redisContainer.getConnectionUrl();
  process.env.API_KEY = 'e2e-test-key';
  process.env.UPLOAD_DIR = '/tmp/e2e-uploads';

  // Initialize database with pgvector
  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('CREATE EXTENSION IF NOT EXISTS vector');
  await client.end();

  // Run migrations
  const { execSync } = await import('child_process');
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  });

  // Create app
  app = await createApp();
  await app.ready();

  // Initialize queue
  createProcessingQueue();

  return { app, postgresContainer, redisContainer };
}

export async function teardownE2E() {
  await closeQueue();
  await app?.close();
  await getPrisma().$disconnect();
  await postgresContainer?.stop();
  await redisContainer?.stop();
}

export function getTestApp(): FastifyInstance {
  return app;
}

export const API_KEY = 'e2e-test-key';
```

### Step 2: RED - Write PDF Upload E2E Test

```typescript
// tests/e2e/pipeline/pdf-upload-flow.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupE2E, teardownE2E, getTestApp, API_KEY } from '../setup/e2e-setup';
import { readFixture, FIXTURES } from '@tests/helpers/fixtures';
import { cleanDatabase, getPrisma } from '@tests/helpers/database';
import { successCallback } from '@tests/mocks/python-worker-mock';

describe('E2E: PDF Upload Flow', () => {
  beforeAll(async () => {
    await setupE2E();
  }, 120000);

  afterAll(async () => {
    await teardownE2E();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('should process PDF: Upload → Queue → Callback → Chunks → Query', async () => {
    const app = getTestApp();
    const pdfBuffer = await readFixture(FIXTURES.pdf.digital);

    // Step 1: Upload PDF
    const uploadResponse = await app.inject({
      method: 'POST',
      url: '/api/documents',
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'multipart/form-data; boundary=---e2e',
      },
      payload: createMultipartPayload('test.pdf', pdfBuffer, 'application/pdf'),
    });

    expect(uploadResponse.statusCode).toBe(201);
    const { id: documentId } = uploadResponse.json();
    expect(documentId).toBeDefined();

    // Step 2: Verify document is PENDING
    let statusResponse = await app.inject({
      method: 'GET',
      url: `/api/documents/${documentId}`,
      headers: { 'X-API-Key': API_KEY },
    });

    expect(statusResponse.json().status).toBe('PENDING');

    // Step 3: Simulate Python worker callback
    const callbackResponse = await app.inject({
      method: 'POST',
      url: '/internal/callback',
      payload: successCallback(documentId, {
        markdown: `# Test Document

## Introduction

This is a test document that has been processed by Docling.
It contains enough content to pass the quality gate validation.

## Main Content

The main content section discusses important topics that will be
chunked and embedded for vector search. Each chunk should maintain
semantic coherence while staying within the configured size limits.

## Conclusion

This concludes the test document content.`,
        pageCount: 1,
        ocrApplied: false,
        processingTimeMs: 250,
      }),
    });

    expect(callbackResponse.statusCode).toBe(200);

    // Step 4: Verify document is COMPLETED
    statusResponse = await app.inject({
      method: 'GET',
      url: `/api/documents/${documentId}`,
      headers: { 'X-API-Key': API_KEY },
    });

    const statusBody = statusResponse.json();
    expect(statusBody.status).toBe('COMPLETED');
    expect(statusBody.chunkCount).toBeGreaterThan(0);

    // Step 5: Query for content
    const queryResponse = await app.inject({
      method: 'POST',
      url: '/api/query',
      headers: { 'X-API-Key': API_KEY },
      payload: {
        query: 'test document content',
        topK: 5,
      },
    });

    expect(queryResponse.statusCode).toBe(200);

    const results = queryResponse.json().results;
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].documentId).toBe(documentId);
    expect(results[0].score).toBeGreaterThan(0);
  }, 60000);

  it('should route PDF to heavy lane', async () => {
    const app = getTestApp();
    const pdfBuffer = await readFixture(FIXTURES.pdf.digital);

    const uploadResponse = await app.inject({
      method: 'POST',
      url: '/api/documents',
      headers: { 'X-API-Key': API_KEY },
      payload: createMultipartPayload('test.pdf', pdfBuffer, 'application/pdf'),
    });

    expect(uploadResponse.json().lane).toBe('heavy');
  });
});

function createMultipartPayload(filename: string, buffer: Buffer, mimeType: string): Buffer {
  const boundary = '---e2e';
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

### Step 3: RED - Write JSON Fast Lane E2E Test

```typescript
// tests/e2e/pipeline/json-fast-lane.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupE2E, teardownE2E, getTestApp, API_KEY } from '../setup/e2e-setup';
import { readFixture, FIXTURES } from '@tests/helpers/fixtures';
import { cleanDatabase, getPrisma } from '@tests/helpers/database';

describe('E2E: JSON Fast Lane Flow', () => {
  beforeAll(async () => {
    await setupE2E();
  }, 120000);

  afterAll(async () => {
    await teardownE2E();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('should process JSON directly without Python worker', async () => {
    const app = getTestApp();
    const jsonBuffer = await readFixture(FIXTURES.json.valid);

    // Step 1: Upload JSON
    const uploadResponse = await app.inject({
      method: 'POST',
      url: '/api/documents',
      headers: { 'X-API-Key': API_KEY },
      payload: createMultipartPayload('data.json', jsonBuffer, 'application/json'),
    });

    expect(uploadResponse.statusCode).toBe(201);

    const { id: documentId, lane } = uploadResponse.json();
    expect(lane).toBe('fast');

    // Step 2: Wait for fast lane processing (should be immediate)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 3: Check status is COMPLETED
    const statusResponse = await app.inject({
      method: 'GET',
      url: `/api/documents/${documentId}`,
      headers: { 'X-API-Key': API_KEY },
    });

    expect(statusResponse.json().status).toBe('COMPLETED');

    // Step 4: Query for JSON content
    const queryResponse = await app.inject({
      method: 'POST',
      url: '/api/query',
      headers: { 'X-API-Key': API_KEY },
      payload: { query: 'JSON content', topK: 3 },
    });

    expect(queryResponse.statusCode).toBe(200);
    expect(queryResponse.json().results.length).toBeGreaterThan(0);
  }, 30000);

  it('should process TXT file via fast lane', async () => {
    const app = getTestApp();
    const txtBuffer = await readFixture(FIXTURES.text.normal);

    const uploadResponse = await app.inject({
      method: 'POST',
      url: '/api/documents',
      headers: { 'X-API-Key': API_KEY },
      payload: createMultipartPayload('readme.txt', txtBuffer, 'text/plain'),
    });

    expect(uploadResponse.statusCode).toBe(201);
    expect(uploadResponse.json().lane).toBe('fast');

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    const { id } = uploadResponse.json();
    const statusResponse = await app.inject({
      method: 'GET',
      url: `/api/documents/${id}`,
      headers: { 'X-API-Key': API_KEY },
    });

    expect(statusResponse.json().status).toBe('COMPLETED');
  }, 30000);

  it('should process Markdown file via fast lane', async () => {
    const app = getTestApp();
    const mdBuffer = await readFixture(FIXTURES.markdown.withHeaders);

    const uploadResponse = await app.inject({
      method: 'POST',
      url: '/api/documents',
      headers: { 'X-API-Key': API_KEY },
      payload: createMultipartPayload('notes.md', mdBuffer, 'text/markdown'),
    });

    expect(uploadResponse.statusCode).toBe(201);
    expect(uploadResponse.json().lane).toBe('fast');

    await new Promise(resolve => setTimeout(resolve, 2000));

    const { id } = uploadResponse.json();
    const statusResponse = await app.inject({
      method: 'GET',
      url: `/api/documents/${id}`,
      headers: { 'X-API-Key': API_KEY },
    });

    expect(statusResponse.json().status).toBe('COMPLETED');

    // Verify chunks have heading metadata
    const prisma = getPrisma();
    const chunks = await prisma.chunk.findMany({
      where: { documentId: id },
    });

    const chunksWithHeading = chunks.filter(c => c.heading);
    expect(chunksWithHeading.length).toBeGreaterThan(0);
  }, 30000);
});

function createMultipartPayload(filename: string, buffer: Buffer, mimeType: string): Buffer {
  const boundary = '---e2e';
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

### Step 4: RED - Write Error Handling E2E Tests

```typescript
// tests/e2e/pipeline/error-handling.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupE2E, teardownE2E, getTestApp, API_KEY } from '../setup/e2e-setup';
import { readFixture, FIXTURES } from '@tests/helpers/fixtures';
import { cleanDatabase } from '@tests/helpers/database';
import { ERRORS } from '@tests/mocks/python-worker-mock';

describe('E2E: Error Handling', () => {
  beforeAll(async () => {
    await setupE2E();
  }, 120000);

  afterAll(async () => {
    await teardownE2E();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('Password Protected PDF', () => {
    it('should reject password-protected PDF via callback', async () => {
      const app = getTestApp();
      const pdfBuffer = await readFixture(FIXTURES.pdf.passwordProtected);

      // Upload
      const uploadResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
        payload: createMultipartPayload('protected.pdf', pdfBuffer, 'application/pdf'),
      });

      const { id: documentId } = uploadResponse.json();

      // Simulate Python worker detecting password protection
      await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: ERRORS.passwordProtected(documentId),
      });

      // Check status
      const statusResponse = await app.inject({
        method: 'GET',
        url: `/api/documents/${documentId}`,
        headers: { 'X-API-Key': API_KEY },
      });

      expect(statusResponse.json().status).toBe('FAILED');
      expect(statusResponse.json().failReason).toBe('PASSWORD_PROTECTED');
    }, 30000);
  });

  describe('Quality Gate Rejection', () => {
    it('should fail document with too little text', async () => {
      const app = getTestApp();
      const pdfBuffer = await readFixture(FIXTURES.pdf.digital);

      // Upload
      const uploadResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
        payload: createMultipartPayload('short.pdf', pdfBuffer, 'application/pdf'),
      });

      const { id: documentId } = uploadResponse.json();

      // Simulate callback with short content
      await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: {
          documentId,
          success: true,
          result: {
            markdown: 'Too short',
            pageCount: 1,
            ocrApplied: false,
            processingTimeMs: 100,
          },
        },
      });

      // Check status
      const statusResponse = await app.inject({
        method: 'GET',
        url: `/api/documents/${documentId}`,
        headers: { 'X-API-Key': API_KEY },
      });

      expect(statusResponse.json().status).toBe('FAILED');
      expect(statusResponse.json().failReason).toContain('TEXT_TOO_SHORT');
    }, 30000);

    it('should fail document with high noise ratio', async () => {
      const app = getTestApp();
      const pdfBuffer = await readFixture(FIXTURES.pdf.digital);

      const uploadResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
        payload: createMultipartPayload('noisy.pdf', pdfBuffer, 'application/pdf'),
      });

      const { id: documentId } = uploadResponse.json();

      // Simulate callback with noisy content (>80% special chars)
      await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: {
          documentId,
          success: true,
          result: {
            markdown: '!@#$%^&*(){}[]|\\/:;"\'<>,.?~`' + 'AB'.repeat(5),
            pageCount: 1,
            ocrApplied: true,
            processingTimeMs: 500,
          },
        },
      });

      const statusResponse = await app.inject({
        method: 'GET',
        url: `/api/documents/${documentId}`,
        headers: { 'X-API-Key': API_KEY },
      });

      expect(statusResponse.json().status).toBe('FAILED');
      expect(statusResponse.json().failReason).toContain('NOISE');
    }, 30000);
  });

  describe('Duplicate File Detection', () => {
    it('should reject upload of duplicate file', async () => {
      const app = getTestApp();
      const pdfBuffer = await readFixture(FIXTURES.pdf.digital);

      // First upload
      const firstUpload = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
        payload: createMultipartPayload('first.pdf', pdfBuffer, 'application/pdf'),
      });

      expect(firstUpload.statusCode).toBe(201);

      // Second upload (same file content)
      const secondUpload = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
        payload: createMultipartPayload('second.pdf', pdfBuffer, 'application/pdf'),
      });

      expect(secondUpload.statusCode).toBe(409);
      expect(secondUpload.json().error).toBe('DUPLICATE_FILE');
      expect(secondUpload.json().existingId).toBe(firstUpload.json().id);
    }, 30000);
  });

  describe('Unsupported Format', () => {
    it('should reject unsupported file format', async () => {
      const app = getTestApp();

      const uploadResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
        payload: createMultipartPayload('image.png', Buffer.from('fake'), 'image/png'),
      });

      expect(uploadResponse.statusCode).toBe(400);
      expect(uploadResponse.json().error).toBe('INVALID_FORMAT');
    });
  });

  describe('File Size Limit', () => {
    it('should reject file exceeding 50MB', async () => {
      const app = getTestApp();
      const largeBuffer = Buffer.alloc(51 * 1024 * 1024); // 51MB

      const uploadResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
        payload: createMultipartPayload('large.pdf', largeBuffer, 'application/pdf'),
      });

      expect(uploadResponse.statusCode).toBe(400);
      expect(uploadResponse.json().error).toBe('FILE_TOO_LARGE');
    });
  });

  describe('Corrupt File', () => {
    it('should fail corrupt PDF via callback', async () => {
      const app = getTestApp();
      const corruptBuffer = await readFixture(FIXTURES.pdf.corrupt);

      const uploadResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
        payload: createMultipartPayload('corrupt.pdf', corruptBuffer, 'application/pdf'),
      });

      const { id: documentId } = uploadResponse.json();

      // Simulate Python worker detecting corruption
      await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: ERRORS.corrupt(documentId),
      });

      const statusResponse = await app.inject({
        method: 'GET',
        url: `/api/documents/${documentId}`,
        headers: { 'X-API-Key': API_KEY },
      });

      expect(statusResponse.json().status).toBe('FAILED');
      expect(statusResponse.json().failReason).toBe('CORRUPT_FILE');
    }, 30000);
  });
});

function createMultipartPayload(filename: string, buffer: Buffer, mimeType: string): Buffer {
  const boundary = '---e2e';
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

### Step 5: RED - Write Query Flow E2E Test

```typescript
// tests/e2e/pipeline/query-flow.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupE2E, teardownE2E, getTestApp, API_KEY } from '../setup/e2e-setup';
import { readFixture, FIXTURES } from '@tests/helpers/fixtures';
import { cleanDatabase, seedDocument, getPrisma } from '@tests/helpers/database';
import { successCallback } from '@tests/mocks/python-worker-mock';
import { mockEmbedding } from '@tests/mocks/embedding-mock';

describe('E2E: Query Flow', () => {
  beforeAll(async () => {
    await setupE2E();
  }, 120000);

  afterAll(async () => {
    await teardownE2E();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('Vector Search', () => {
    it('should return relevant results for semantic query', async () => {
      const app = getTestApp();

      // Create and process document
      const pdfBuffer = await readFixture(FIXTURES.pdf.digital);

      const uploadResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
        payload: createMultipartPayload('ml-doc.pdf', pdfBuffer, 'application/pdf'),
      });

      const { id: documentId } = uploadResponse.json();

      // Simulate callback with ML content
      await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: successCallback(documentId, {
          markdown: `# Machine Learning Guide

## Introduction to Machine Learning

Machine learning is a subset of artificial intelligence that enables
systems to learn and improve from experience without being explicitly
programmed. It focuses on developing algorithms that can access data
and use it to learn for themselves.

## Types of Machine Learning

### Supervised Learning
Supervised learning uses labeled datasets to train algorithms to
classify data or predict outcomes accurately.

### Unsupervised Learning
Unsupervised learning uses unlabeled data to discover patterns
and relationships in data without predetermined outcomes.

### Reinforcement Learning
Reinforcement learning trains agents to make decisions by rewarding
desired behaviors and punishing undesired ones.`,
          pageCount: 1,
          ocrApplied: false,
          processingTimeMs: 300,
        }),
      });

      // Query for relevant content
      const queryResponse = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: {
          query: 'what are the types of machine learning',
          topK: 5,
        },
      });

      expect(queryResponse.statusCode).toBe(200);

      const results = queryResponse.json().results;
      expect(results.length).toBeGreaterThan(0);

      // Results should be from our document
      expect(results[0].documentId).toBe(documentId);

      // Results should have valid scores
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].score).toBeLessThanOrEqual(1);
    }, 60000);

    it('should respect topK limit', async () => {
      const app = getTestApp();
      const prisma = getPrisma();

      // Create document with many chunks
      const doc = await seedDocument({ status: 'COMPLETED' });

      // Insert 20 chunks
      for (let i = 0; i < 20; i++) {
        const embedding = mockEmbedding(`chunk ${i} content`);
        await prisma.$executeRaw`
          INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, created_at)
          VALUES (gen_random_uuid(), ${doc.id}, ${`Chunk ${i} with searchable content`}, ${i}, ${embedding}::vector, ${i * 100}, ${(i + 1) * 100}, NOW())
        `;
      }

      // Query with topK=5
      const queryResponse = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: { query: 'searchable content', topK: 5 },
      });

      expect(queryResponse.json().results).toHaveLength(5);
    }, 30000);

    it('should return results ordered by similarity', async () => {
      const app = getTestApp();
      const prisma = getPrisma();

      const doc = await seedDocument({ status: 'COMPLETED' });

      // Insert chunks with varying similarity to query
      const contents = [
        'machine learning algorithms',
        'deep learning neural networks',
        'cooking recipes and tips',
        'machine learning models',
      ];

      for (let i = 0; i < contents.length; i++) {
        const embedding = mockEmbedding(contents[i]);
        await prisma.$executeRaw`
          INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, created_at)
          VALUES (gen_random_uuid(), ${doc.id}, ${contents[i]}, ${i}, ${embedding}::vector, ${i * 50}, ${(i + 1) * 50}, NOW())
        `;
      }

      const queryResponse = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: { query: 'machine learning', topK: 4 },
      });

      const results = queryResponse.json().results;

      // Results should be sorted by score descending
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    }, 30000);

    it('should include metadata in results', async () => {
      const app = getTestApp();
      const prisma = getPrisma();

      const doc = await seedDocument({ status: 'COMPLETED' });

      const embedding = mockEmbedding('test content');
      await prisma.$executeRaw`
        INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, page, heading, created_at)
        VALUES (gen_random_uuid(), ${doc.id}, 'Test content for metadata check', 0, ${embedding}::vector, 0, 30, 5, 'Chapter 1', NOW())
      `;

      const queryResponse = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: { query: 'test content', topK: 1 },
      });

      const result = queryResponse.json().results[0];

      expect(result.metadata).toBeDefined();
      expect(result.metadata.charStart).toBe(0);
      expect(result.metadata.charEnd).toBe(30);
      expect(result.metadata.page).toBe(5);
      expect(result.metadata.heading).toBe('Chapter 1');
    }, 30000);

    it('should return empty array when no chunks exist', async () => {
      const app = getTestApp();

      const queryResponse = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: { query: 'any query', topK: 5 },
      });

      expect(queryResponse.statusCode).toBe(200);
      expect(queryResponse.json().results).toHaveLength(0);
    });
  });
});

function createMultipartPayload(filename: string, buffer: Buffer, mimeType: string): Buffer {
  const boundary = '---e2e';
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

---

## Todo List

- [ ] Create `tests/e2e/setup/e2e-setup.ts`
- [ ] Write `tests/e2e/pipeline/pdf-upload-flow.test.ts` (RED)
- [ ] Write `tests/e2e/pipeline/json-fast-lane.test.ts` (RED)
- [ ] Write `tests/e2e/pipeline/error-handling.test.ts` (RED)
- [ ] Write `tests/e2e/pipeline/query-flow.test.ts` (RED)
- [ ] Implement any missing integration pieces (GREEN)
- [ ] Run `pnpm test:e2e` - all tests pass
- [ ] Verify full pipeline works end-to-end

---

## Success Criteria

1. All E2E tests pass with real PostgreSQL + Redis
2. PDF flow: Upload → Callback → Query works
3. Fast lane: JSON/TXT/MD processed directly
4. Error scenarios handled correctly
5. Query returns relevant results

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| E2E tests flaky | Generous timeouts, proper cleanup |
| Container startup slow | Parallel container start |
| Test isolation issues | Clean DB between tests |

---

## Security Considerations

- E2E tests run in isolated containers
- No real credentials used
- Test data only in test environment

---

## Next Steps

After completion, Node.js backend is feature-complete. Proceed to [Phase 07: Python AI Worker](./phase-07-python-ai-worker.md) for Docling integration.
