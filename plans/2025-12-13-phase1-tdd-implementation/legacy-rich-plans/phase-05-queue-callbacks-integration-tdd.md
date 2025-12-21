# Phase 05: Queue & Callbacks Integration (TDD)

**Parent:** [plan.md](./plan.md) | **Dependencies:** Phases 02-04 | **Blocks:** Phase 06

---

## Overview

| Field | Value |
|-------|-------|
| Date | 2025-12-13 |
| Priority | P0 (Critical) |
| Est. Hours | 6 |
| Status | Pending |

**Description:** TDD approach for BullMQ queue integration and Python worker callback handling. Tests cover job creation, retries, DLQ, and status transitions.

---

## Key Insights (from Research)

- BullMQ 5.x requires Redis 6.2+
- UnrecoverableError skips retries (for permanent failures)
- Exponential backoff: 5s → 10s → 20s (3 attempts)
- Dead Letter Queue (DLQ) for failed jobs
- HTTP callback from Python to Node.js updates document status

---

## Requirements

### Acceptance Criteria
- [ ] Job created on document upload (tested via mock)
- [ ] Job retries 3 times with exponential backoff
- [ ] Failed jobs move to Dead Letter Queue
- [ ] Python callback updates document status
- [ ] PENDING → PROCESSING → COMPLETED/FAILED transitions
- [ ] Fast lane processes directly (no queue for PDF)

---

## Architecture

### Queue Flow

```
Upload (Node.js)
      │
      ├─ Fast Lane (json/txt/md)
      │       │
      │       ▼
      │   Direct Processing ──────────┐
      │                               │
      ├─ Heavy Lane (pdf)             │
      │       │                       │
      │       ▼                       ▼
      │   BullMQ Queue          Chunking + Embedding
      │       │                       │
      │       ▼                       ▼
      │   Python Worker          Save to DB
      │       │                       │
      │       ▼                       │
      │   HTTP Callback ──────────────┘
      │
      ▼
  Document Status Updated
```

### Status State Machine

```
PENDING ─────────────────────┐
    │                        │
    ▼                        │
PROCESSING                   │
    │                        │
    ├─ success ─────► COMPLETED
    │
    └─ failure (retryable)
           │
           ▼
       RETRY (1-3)
           │
           ├─ success ─────► COMPLETED
           │
           └─ max retries ──► FAILED
```

---

## Related Code Files

| File | Purpose |
|------|---------|
| `tests/integration/queue/processing-queue.test.ts` | Queue tests |
| `tests/integration/queue/retry-handler.test.ts` | Retry tests |
| `tests/integration/routes/callback-route.test.ts` | Callback tests |
| `tests/integration/queue/fast-lane.test.ts` | Direct processing |
| `src/queue/processing-queue.ts` | Queue setup |
| `src/queue/job-processor.ts` | Job processing |
| `src/queue/retry-handler.ts` | Retry logic |
| `src/routes/internal/callback-route.ts` | Callback handler |
| `src/services/fast-lane-processor.ts` | Fast lane impl |

---

## Implementation Steps (TDD Cycle)

### Step 1: RED - Write Processing Queue Tests

```typescript
// tests/integration/queue/processing-queue.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Queue, Job } from 'bullmq';
import { createProcessingQueue, ProcessingJob } from '@/queue/processing-queue';
import { RedisContainer } from '@testcontainers/redis';

describe('ProcessingQueue', () => {
  let redis: any;
  let queue: Queue<ProcessingJob>;

  beforeAll(async () => {
    redis = await new RedisContainer().start();
    process.env.REDIS_URL = redis.getConnectionUrl();
    queue = createProcessingQueue();
  });

  afterAll(async () => {
    await queue.close();
    await redis.stop();
  });

  beforeEach(async () => {
    await queue.drain();
  });

  describe('job creation', () => {
    it('should add job to queue', async () => {
      const jobData: ProcessingJob = {
        documentId: 'doc-123',
        filePath: '/tmp/test.pdf',
        format: 'pdf',
        config: {
          ocrMode: 'auto',
          ocrLanguages: ['en'],
        },
      };

      const job = await queue.add('process', jobData);

      expect(job.id).toBeDefined();
      expect(job.name).toBe('process');
      expect(job.data.documentId).toBe('doc-123');
    });

    it('should set default retry options', async () => {
      const job = await queue.add('process', {
        documentId: 'doc-123',
        filePath: '/tmp/test.pdf',
        format: 'pdf',
        config: { ocrMode: 'auto', ocrLanguages: ['en'] },
      });

      expect(job.opts.attempts).toBe(3);
      expect(job.opts.backoff).toEqual({
        type: 'exponential',
        delay: 5000,
      });
    });

    it('should include job timeout', async () => {
      const job = await queue.add('process', {
        documentId: 'doc-123',
        filePath: '/tmp/test.pdf',
        format: 'pdf',
        config: { ocrMode: 'auto', ocrLanguages: ['en'] },
      });

      // 5 minute timeout for processing
      expect(job.opts.timeout).toBe(300000);
    });
  });

  describe('queue state', () => {
    it('should track waiting jobs', async () => {
      await queue.add('process', {
        documentId: 'doc-1',
        filePath: '/tmp/test1.pdf',
        format: 'pdf',
        config: { ocrMode: 'auto', ocrLanguages: ['en'] },
      });

      const waiting = await queue.getWaiting();
      expect(waiting.length).toBeGreaterThanOrEqual(1);
    });

    it('should retrieve job by ID', async () => {
      const addedJob = await queue.add('process', {
        documentId: 'doc-retrieve',
        filePath: '/tmp/test.pdf',
        format: 'pdf',
        config: { ocrMode: 'auto', ocrLanguages: ['en'] },
      });

      const retrieved = await queue.getJob(addedJob.id!);
      expect(retrieved?.data.documentId).toBe('doc-retrieve');
    });
  });
});
```

### Step 2: GREEN - Implement Processing Queue

```typescript
// src/queue/processing-queue.ts
import { Queue, QueueOptions } from 'bullmq';
import IORedis from 'ioredis';

export interface ProcessingJob {
  documentId: string;
  filePath: string;
  format: 'pdf' | 'json' | 'txt' | 'md';
  config: {
    ocrMode: 'auto' | 'force' | 'never';
    ocrLanguages: string[];
  };
}

let queue: Queue<ProcessingJob> | null = null;

export function createProcessingQueue(): Queue<ProcessingJob> {
  if (queue) return queue;

  const connection = new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
  });

  queue = new Queue<ProcessingJob>('document-processing', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000, // 5s → 10s → 20s
      },
      timeout: 300000, // 5 minutes
      removeOnComplete: {
        age: 3600, // 1 hour
        count: 1000,
      },
      removeOnFail: {
        age: 86400, // 24 hours
      },
    },
  });

  return queue;
}

export function getProcessingQueue(): Queue<ProcessingJob> {
  if (!queue) {
    return createProcessingQueue();
  }
  return queue;
}

export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
```

### Step 3: RED - Write Retry Handler Tests

```typescript
// tests/integration/queue/retry-handler.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Worker, Job, UnrecoverableError } from 'bullmq';
import { createProcessingQueue, ProcessingJob } from '@/queue/processing-queue';
import { createJobProcessor } from '@/queue/job-processor';
import { cleanDatabase, seedDocument, getPrisma } from '@tests/helpers/database';
import { RedisContainer } from '@testcontainers/redis';

describe('RetryHandler', () => {
  let redis: any;
  let queue: any;
  let worker: Worker;
  const processedJobs: string[] = [];

  beforeAll(async () => {
    redis = await new RedisContainer().start();
    process.env.REDIS_URL = redis.getConnectionUrl();
    queue = createProcessingQueue();
  });

  afterAll(async () => {
    await worker?.close();
    await queue.close();
    await redis.stop();
  });

  beforeEach(async () => {
    processedJobs.length = 0;
    await queue.drain();
    await cleanDatabase();
  });

  describe('retry behavior', () => {
    it('should retry failed job up to 3 times', async () => {
      let attemptCount = 0;

      worker = new Worker<ProcessingJob>(
        'document-processing',
        async (job) => {
          attemptCount++;
          throw new Error('Temporary failure');
        },
        { connection: queue.opts.connection }
      );

      const doc = await seedDocument({ status: 'PENDING' });

      await queue.add('process', {
        documentId: doc.id,
        filePath: '/tmp/test.pdf',
        format: 'pdf',
        config: { ocrMode: 'auto', ocrLanguages: ['en'] },
      });

      // Wait for retries
      await new Promise(resolve => setTimeout(resolve, 20000));

      // Should have attempted 3 times (initial + 2 retries)
      expect(attemptCount).toBe(3);
    }, 30000);

    it('should not retry UnrecoverableError', async () => {
      let attemptCount = 0;

      worker = new Worker<ProcessingJob>(
        'document-processing',
        async (job) => {
          attemptCount++;
          throw new UnrecoverableError('Password protected PDF');
        },
        { connection: queue.opts.connection }
      );

      const doc = await seedDocument({ status: 'PENDING' });

      await queue.add('process', {
        documentId: doc.id,
        filePath: '/tmp/test.pdf',
        format: 'pdf',
        config: { ocrMode: 'auto', ocrLanguages: ['en'] },
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Should only attempt once
      expect(attemptCount).toBe(1);
    }, 10000);

    it('should update document status to FAILED after max retries', async () => {
      const prisma = getPrisma();
      const doc = await seedDocument({ status: 'PROCESSING' });

      worker = new Worker<ProcessingJob>(
        'document-processing',
        async (job) => {
          // Update retry count in DB
          await prisma.document.update({
            where: { id: job.data.documentId },
            data: { retryCount: job.attemptsMade },
          });
          throw new Error('Failure');
        },
        { connection: queue.opts.connection }
      );

      worker.on('failed', async (job, err) => {
        if (job && job.attemptsMade >= 3) {
          await prisma.document.update({
            where: { id: job.data.documentId },
            data: {
              status: 'FAILED',
              failReason: err.message,
            },
          });
        }
      });

      await queue.add('process', {
        documentId: doc.id,
        filePath: '/tmp/test.pdf',
        format: 'pdf',
        config: { ocrMode: 'auto', ocrLanguages: ['en'] },
      });

      // Wait for all retries
      await new Promise(resolve => setTimeout(resolve, 25000));

      const updated = await prisma.document.findUnique({
        where: { id: doc.id },
      });

      expect(updated?.status).toBe('FAILED');
      expect(updated?.retryCount).toBe(3);
    }, 35000);
  });

  describe('exponential backoff', () => {
    it('should use exponential delays', async () => {
      const attemptTimes: number[] = [];

      worker = new Worker<ProcessingJob>(
        'document-processing',
        async (job) => {
          attemptTimes.push(Date.now());
          throw new Error('Failure');
        },
        { connection: queue.opts.connection }
      );

      const doc = await seedDocument({ status: 'PENDING' });

      await queue.add('process', {
        documentId: doc.id,
        filePath: '/tmp/test.pdf',
        format: 'pdf',
        config: { ocrMode: 'auto', ocrLanguages: ['en'] },
      });

      // Wait for retries
      await new Promise(resolve => setTimeout(resolve, 25000));

      // Check delays are increasing
      if (attemptTimes.length >= 3) {
        const delay1 = attemptTimes[1] - attemptTimes[0];
        const delay2 = attemptTimes[2] - attemptTimes[1];

        // Second delay should be roughly 2x first
        expect(delay2).toBeGreaterThan(delay1);
      }
    }, 35000);
  });
});
```

### Step 4: GREEN - Implement Job Processor

```typescript
// src/queue/job-processor.ts
import { Worker, Job, UnrecoverableError } from 'bullmq';
import { ProcessingJob } from './processing-queue';
import { getPrisma } from '@/database';

// Error codes that should not be retried
const PERMANENT_ERRORS = [
  'PASSWORD_PROTECTED',
  'CORRUPT_FILE',
  'UNSUPPORTED_FORMAT',
];

export function createJobProcessor(connection: any): Worker<ProcessingJob> {
  const worker = new Worker<ProcessingJob>(
    'document-processing',
    async (job) => {
      const prisma = getPrisma();

      // Update status to PROCESSING
      await prisma.document.update({
        where: { id: job.data.documentId },
        data: {
          status: 'PROCESSING',
          retryCount: job.attemptsMade,
        },
      });

      // Note: Actual processing happens in Python worker
      // This Node.js worker just updates status and waits for callback
      // In production, this would not process here but wait for Python

      job.log(`Processing document ${job.data.documentId}`);

      // The actual processing is done by Python worker polling Redis
      // This processor just marks the document as PROCESSING
    },
    {
      connection,
      concurrency: 5,
    }
  );

  // Handle job completion (via callback)
  worker.on('completed', async (job) => {
    console.log(`Job ${job?.id} completed`);
  });

  // Handle job failure
  worker.on('failed', async (job, err) => {
    if (!job) return;

    const prisma = getPrisma();
    const isPermanent = PERMANENT_ERRORS.some(code =>
      err.message.includes(code)
    );

    if (isPermanent || job.attemptsMade >= 3) {
      await prisma.document.update({
        where: { id: job.data.documentId },
        data: {
          status: 'FAILED',
          failReason: err.message,
          retryCount: job.attemptsMade,
        },
      });
    }
  });

  return worker;
}

/**
 * Mark error as permanent (no retry)
 */
export function permanentError(message: string): UnrecoverableError {
  return new UnrecoverableError(message);
}
```

### Step 5: RED - Write Callback Route Tests

```typescript
// tests/integration/routes/callback-route.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestApp, closeTestApp } from '@tests/helpers/api';
import { cleanDatabase, seedDocument, getPrisma } from '@tests/helpers/database';
import { successCallback, ERRORS } from '@tests/mocks/python-worker-mock';

describe('POST /internal/callback', () => {
  let app: any;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('successful callback', () => {
    it('should update document to COMPLETED', async () => {
      const doc = await seedDocument({ status: 'PROCESSING' });

      const response = await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: successCallback(doc.id, {
          markdown: '# Test Document\n\nContent here.',
          pageCount: 1,
          ocrApplied: false,
          processingTimeMs: 150,
        }),
      });

      expect(response.statusCode).toBe(200);

      const prisma = getPrisma();
      const updated = await prisma.document.findUnique({
        where: { id: doc.id },
      });

      expect(updated?.status).toBe('COMPLETED');
    });

    it('should create chunks from markdown', async () => {
      const doc = await seedDocument({ status: 'PROCESSING' });

      await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: successCallback(doc.id, {
          markdown: '# Title\n\nFirst paragraph with enough content to be a valid chunk. '.repeat(20),
          pageCount: 1,
          ocrApplied: false,
          processingTimeMs: 100,
        }),
      });

      const prisma = getPrisma();
      const chunks = await prisma.chunk.findMany({
        where: { documentId: doc.id },
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should generate embeddings for chunks', async () => {
      const doc = await seedDocument({ status: 'PROCESSING' });

      await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: successCallback(doc.id, {
          markdown: '# Test\n\nContent that will be embedded for vector search capabilities.',
          pageCount: 1,
          ocrApplied: false,
          processingTimeMs: 100,
        }),
      });

      // Verify embeddings exist (checking via raw query)
      const prisma = getPrisma();
      const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM chunks
        WHERE document_id = ${doc.id}
        AND embedding IS NOT NULL
      `;

      expect(Number(result[0].count)).toBeGreaterThan(0);
    });
  });

  describe('failure callback', () => {
    it('should update document to FAILED with reason', async () => {
      const doc = await seedDocument({ status: 'PROCESSING' });

      const response = await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: ERRORS.passwordProtected(doc.id),
      });

      expect(response.statusCode).toBe(200);

      const prisma = getPrisma();
      const updated = await prisma.document.findUnique({
        where: { id: doc.id },
      });

      expect(updated?.status).toBe('FAILED');
      expect(updated?.failReason).toBe('PASSWORD_PROTECTED');
    });

    it('should handle corrupt file error', async () => {
      const doc = await seedDocument({ status: 'PROCESSING' });

      await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: ERRORS.corrupt(doc.id),
      });

      const prisma = getPrisma();
      const updated = await prisma.document.findUnique({
        where: { id: doc.id },
      });

      expect(updated?.failReason).toBe('CORRUPT_FILE');
    });

    it('should handle timeout error', async () => {
      const doc = await seedDocument({ status: 'PROCESSING' });

      await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: ERRORS.timeout(doc.id),
      });

      const prisma = getPrisma();
      const updated = await prisma.document.findUnique({
        where: { id: doc.id },
      });

      expect(updated?.failReason).toBe('TIMEOUT');
    });
  });

  describe('validation', () => {
    it('should reject invalid documentId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: {
          documentId: 'not-a-uuid',
          success: true,
          result: {
            markdown: '# Test',
            pageCount: 1,
            ocrApplied: false,
            processingTimeMs: 100,
          },
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject callback for non-existent document', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: successCallback('00000000-0000-0000-0000-000000000000'),
      });

      expect(response.statusCode).toBe(404);
    });

    it('should not require API key (internal route)', async () => {
      const doc = await seedDocument({ status: 'PROCESSING' });

      const response = await app.inject({
        method: 'POST',
        url: '/internal/callback',
        // No X-API-Key header
        payload: successCallback(doc.id),
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('quality gate', () => {
    it('should reject low quality content', async () => {
      const doc = await seedDocument({ status: 'PROCESSING' });

      const response = await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: successCallback(doc.id, {
          markdown: 'Too short', // < 50 chars
          pageCount: 1,
          ocrApplied: false,
          processingTimeMs: 100,
        }),
      });

      expect(response.statusCode).toBe(200);

      const prisma = getPrisma();
      const updated = await prisma.document.findUnique({
        where: { id: doc.id },
      });

      expect(updated?.status).toBe('FAILED');
      expect(updated?.failReason).toContain('TEXT_TOO_SHORT');
    });
  });
});
```

### Step 6: GREEN - Implement Callback Route

```typescript
// src/routes/internal/callback-route.ts
import { FastifyInstance } from 'fastify';
import { CallbackSchema } from '@/validators';
import { ChunkerService, QualityGateService, EmbeddingService } from '@/services';
import { getPrisma } from '@/database';

const chunker = new ChunkerService({ chunkSize: 1000, chunkOverlap: 200 });
const qualityGate = new QualityGateService();
const embedder = new EmbeddingService();

export async function callbackRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/internal/callback', async (request, reply) => {
    const parsed = CallbackSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.message,
      });
    }

    const { documentId, success, result, error } = parsed.data;
    const prisma = getPrisma();

    // Check document exists
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Document not found',
      });
    }

    // Handle failure callback
    if (!success && error) {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'FAILED',
          failReason: error.code,
        },
      });

      return reply.send({ status: 'acknowledged', result: 'failed' });
    }

    // Handle success callback
    if (success && result) {
      try {
        // Quality gate check
        const quality = qualityGate.validate(result.markdown);

        if (!quality.passed) {
          await prisma.document.update({
            where: { id: documentId },
            data: {
              status: 'FAILED',
              failReason: quality.reason,
            },
          });

          return reply.send({ status: 'acknowledged', result: 'quality_failed' });
        }

        // Chunk the markdown
        const { chunks } = await chunker.chunk(result.markdown);

        if (chunks.length === 0) {
          await prisma.document.update({
            where: { id: documentId },
            data: {
              status: 'FAILED',
              failReason: 'NO_CONTENT',
            },
          });

          return reply.send({ status: 'acknowledged', result: 'no_content' });
        }

        // Generate embeddings
        const embeddings = await embedder.embedBatch(chunks.map(c => c.content));

        // Save chunks with embeddings
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embedding = embeddings[i];

          await prisma.$executeRaw`
            INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, heading, created_at)
            VALUES (
              gen_random_uuid(),
              ${documentId},
              ${chunk.content},
              ${chunk.index},
              ${embedding}::vector,
              ${chunk.metadata.charStart},
              ${chunk.metadata.charEnd},
              ${chunk.metadata.heading || null},
              NOW()
            )
          `;
        }

        // Update document status
        await prisma.document.update({
          where: { id: documentId },
          data: { status: 'COMPLETED' },
        });

        return reply.send({
          status: 'acknowledged',
          result: 'success',
          chunksCreated: chunks.length,
        });
      } catch (err: any) {
        await prisma.document.update({
          where: { id: documentId },
          data: {
            status: 'FAILED',
            failReason: `PROCESSING_ERROR: ${err.message}`,
          },
        });

        return reply.status(500).send({
          error: 'PROCESSING_ERROR',
          message: err.message,
        });
      }
    }

    return reply.status(400).send({
      error: 'INVALID_CALLBACK',
      message: 'Callback must have either result or error',
    });
  });
}
```

### Step 7: RED - Write Fast Lane Tests

```typescript
// tests/integration/queue/fast-lane.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastLaneProcessor } from '@/services/fast-lane-processor';
import { cleanDatabase, seedDocument, getPrisma } from '@tests/helpers/database';
import { readFixtureText, FIXTURES } from '@tests/helpers/fixtures';

describe('FastLaneProcessor', () => {
  let processor: FastLaneProcessor;

  beforeAll(() => {
    processor = new FastLaneProcessor();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('JSON processing', () => {
    it('should process valid JSON file', async () => {
      const doc = await seedDocument({
        format: 'json',
        lane: 'fast',
        status: 'PENDING',
      });

      const content = await readFixtureText(FIXTURES.json.valid);
      const result = await processor.process(doc.id, content, 'json');

      expect(result.success).toBe(true);
      expect(result.chunksCreated).toBeGreaterThan(0);
    });

    it('should handle malformed JSON gracefully', async () => {
      const doc = await seedDocument({
        format: 'json',
        lane: 'fast',
        status: 'PENDING',
      });

      const content = await readFixtureText(FIXTURES.json.malformed);
      const result = await processor.process(doc.id, content, 'json');

      expect(result.success).toBe(false);
      expect(result.error).toContain('INVALID_JSON');
    });

    it('should update document status to COMPLETED', async () => {
      const doc = await seedDocument({
        format: 'json',
        lane: 'fast',
        status: 'PENDING',
      });

      const content = await readFixtureText(FIXTURES.json.valid);
      await processor.process(doc.id, content, 'json');

      const prisma = getPrisma();
      const updated = await prisma.document.findUnique({
        where: { id: doc.id },
      });

      expect(updated?.status).toBe('COMPLETED');
    });
  });

  describe('TXT processing', () => {
    it('should process plain text file', async () => {
      const doc = await seedDocument({
        format: 'txt',
        lane: 'fast',
        status: 'PENDING',
      });

      const content = await readFixtureText(FIXTURES.text.normal);
      const result = await processor.process(doc.id, content, 'txt');

      expect(result.success).toBe(true);
    });

    it('should handle unicode text', async () => {
      const doc = await seedDocument({
        format: 'txt',
        lane: 'fast',
        status: 'PENDING',
      });

      const content = await readFixtureText(FIXTURES.text.unicode);
      const result = await processor.process(doc.id, content, 'txt');

      expect(result.success).toBe(true);
    });

    it('should reject empty text file', async () => {
      const doc = await seedDocument({
        format: 'txt',
        lane: 'fast',
        status: 'PENDING',
      });

      const result = await processor.process(doc.id, '', 'txt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('TEXT_TOO_SHORT');
    });
  });

  describe('Markdown processing', () => {
    it('should process markdown with headers', async () => {
      const doc = await seedDocument({
        format: 'md',
        lane: 'fast',
        status: 'PENDING',
      });

      const content = await readFixtureText(FIXTURES.markdown.withHeaders);
      const result = await processor.process(doc.id, content, 'md');

      expect(result.success).toBe(true);
    });

    it('should preserve markdown structure in chunks', async () => {
      const doc = await seedDocument({
        format: 'md',
        lane: 'fast',
        status: 'PENDING',
      });

      const content = await readFixtureText(FIXTURES.markdown.withHeaders);
      await processor.process(doc.id, content, 'md');

      const prisma = getPrisma();
      const chunks = await prisma.chunk.findMany({
        where: { documentId: doc.id },
        orderBy: { chunkIndex: 'asc' },
      });

      // Should have heading metadata
      const chunksWithHeading = chunks.filter(c => c.heading);
      expect(chunksWithHeading.length).toBeGreaterThan(0);
    });
  });
});
```

### Step 8: GREEN - Implement Fast Lane Processor

```typescript
// src/services/fast-lane-processor.ts
import { ChunkerService } from './chunker-service';
import { QualityGateService } from './quality-gate-service';
import { EmbeddingService } from './embedding-service';
import { getPrisma } from '@/database';

interface ProcessingResult {
  success: boolean;
  chunksCreated?: number;
  error?: string;
}

export class FastLaneProcessor {
  private chunker: ChunkerService;
  private qualityGate: QualityGateService;
  private embedder: EmbeddingService;

  constructor() {
    this.chunker = new ChunkerService({ chunkSize: 1000, chunkOverlap: 200 });
    this.qualityGate = new QualityGateService();
    this.embedder = new EmbeddingService();
  }

  async process(
    documentId: string,
    content: string,
    format: 'json' | 'txt' | 'md'
  ): Promise<ProcessingResult> {
    const prisma = getPrisma();

    try {
      // Update status to PROCESSING
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'PROCESSING' },
      });

      // Convert to text if JSON
      let text = content;
      if (format === 'json') {
        try {
          const parsed = JSON.parse(content);
          text = JSON.stringify(parsed, null, 2);
        } catch {
          await this.markFailed(documentId, 'INVALID_JSON');
          return { success: false, error: 'INVALID_JSON' };
        }
      }

      // Quality gate
      const quality = this.qualityGate.validate(text);
      if (!quality.passed) {
        await this.markFailed(documentId, quality.reason!);
        return { success: false, error: quality.reason };
      }

      // Chunk
      const { chunks } = await this.chunker.chunk(text);

      if (chunks.length === 0) {
        await this.markFailed(documentId, 'NO_CONTENT');
        return { success: false, error: 'NO_CONTENT' };
      }

      // Generate embeddings
      const embeddings = await this.embedder.embedBatch(
        chunks.map(c => c.content)
      );

      // Save chunks
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];

        await prisma.$executeRaw`
          INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, heading, created_at)
          VALUES (
            gen_random_uuid(),
            ${documentId},
            ${chunk.content},
            ${chunk.index},
            ${embedding}::vector,
            ${chunk.metadata.charStart},
            ${chunk.metadata.charEnd},
            ${chunk.metadata.heading || null},
            NOW()
          )
        `;
      }

      // Mark completed
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'COMPLETED' },
      });

      return { success: true, chunksCreated: chunks.length };
    } catch (err: any) {
      await this.markFailed(documentId, `PROCESSING_ERROR: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  private async markFailed(documentId: string, reason: string): Promise<void> {
    const prisma = getPrisma();
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'FAILED',
        failReason: reason,
      },
    });
  }
}
```

---

## Todo List

- [ ] Write `tests/integration/queue/processing-queue.test.ts` (RED)
- [ ] Implement `src/queue/processing-queue.ts` (GREEN)
- [ ] Write `tests/integration/queue/retry-handler.test.ts` (RED)
- [ ] Implement `src/queue/job-processor.ts` (GREEN)
- [ ] Write `tests/integration/routes/callback-route.test.ts` (RED)
- [ ] Implement `src/routes/internal/callback-route.ts` (GREEN)
- [ ] Write `tests/integration/queue/fast-lane.test.ts` (RED)
- [ ] Implement `src/services/fast-lane-processor.ts` (GREEN)
- [ ] Register callback route in app.ts
- [ ] Run `pnpm test:integration` - all tests pass
- [ ] Verify retry behavior works correctly

---

## Success Criteria

1. All queue tests pass with real Redis
2. Jobs retry 3 times with exponential backoff
3. Callback updates document status correctly
4. Fast lane processes directly without Python
5. Failed jobs have proper fail reasons

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Redis connection issues | Retry with backoff |
| Callback race conditions | Idempotent updates |
| Long-running jobs | 5-minute timeout |

---

## Security Considerations

- Callback endpoint on internal network only
- No authentication for internal routes
- Validate callback payloads strictly

---

## Next Steps

After completion, proceed to [Phase 06: E2E Pipeline (TDD)](./phase-06-e2e-pipeline-tdd.md) for full pipeline integration tests.
