# Phase 01: Test Infrastructure

**Parent:** [plan.md](./plan.md) | **Dependencies:** Phase 00 | **Blocks:** Phases 02-06

---

## Overview

| Field | Value |
|-------|-------|
| Date | 2025-12-13 |
| Priority | P0 (Critical) |
| Est. Hours | 6 |
| Status | Pending |

**Description:** Set up Vitest configuration, Testcontainers for PostgreSQL/Redis, test fixtures (PDFs, JSON, TXT), and mock utilities. All TDD phases depend on this infrastructure.

---

## Key Insights (from Research)

- Vitest 30-70% faster than Jest with native ESM
- Testcontainers: use dynamic port mapping to avoid CI collisions
- Mock Service Worker (MSW) preferred for HTTP mocking
- Deterministic embeddings via seeded random for test reproducibility
- Single embedder instance pattern (expensive to initialize)

---

## Requirements

### Acceptance Criteria
- [ ] `pnpm test:unit` runs unit tests without Docker
- [ ] `pnpm test:integration` spins up Testcontainers automatically
- [ ] Test fixtures include digital PDF, scanned PDF, password-protected PDF, corrupt PDF
- [ ] Mock embedding returns deterministic 384d vectors
- [ ] Mock Python worker simulates success/failure callbacks

---

## Architecture

### Test Directory Structure

```
tests/
├── fixtures/
│   ├── pdfs/
│   │   ├── simple-digital.pdf        # 1 page, text only
│   │   ├── multi-page.pdf            # 5 pages
│   │   ├── password-protected.pdf    # Should reject
│   │   ├── scanned-image.pdf         # Needs OCR
│   │   └── corrupt.pdf               # Invalid file
│   ├── json/
│   │   ├── valid.json                # Simple JSON
│   │   └── malformed.json            # Invalid JSON
│   ├── text/
│   │   ├── normal.txt                # Plain text
│   │   ├── unicode.txt               # UTF-8 special chars
│   │   └── empty.txt                 # Edge case
│   ├── markdown/
│   │   ├── with-headers.md           # Headers for chunking
│   │   └── code-blocks.md            # Code blocks
│   └── expected/
│       ├── simple-digital.md         # Expected markdown output
│       └── multi-page.md
├── mocks/
│   ├── embedding-mock.ts             # Deterministic embeddings
│   ├── python-worker-mock.ts         # HTTP callback stub
│   └── bullmq-mock.ts                # In-memory queue
├── helpers/
│   ├── fixtures.ts                   # Load test files
│   ├── database.ts                   # Testcontainers setup
│   ├── redis.ts                      # Redis container
│   └── api.ts                        # Fastify test client
├── setup/
│   ├── global-setup.ts               # Runs once before all tests
│   └── setup-file.ts                 # Runs before each test file
├── unit/
│   └── (unit test files)
├── integration/
│   └── (integration test files)
└── e2e/
    └── (e2e test files)
```

---

## Related Code Files

| File | Purpose |
|------|---------|
| `apps/backend/vitest.config.ts` | Vitest configuration |
| `tests/setup/global-setup.ts` | Global test setup |
| `tests/setup/setup-file.ts` | Per-file setup |
| `tests/helpers/fixtures.ts` | Fixture loading utilities |
| `tests/helpers/database.ts` | PostgreSQL Testcontainer |
| `tests/helpers/redis.ts` | Redis Testcontainer |
| `tests/mocks/embedding-mock.ts` | Deterministic embedding generator |
| `tests/mocks/python-worker-mock.ts` | Python callback simulator |
| `tests/mocks/bullmq-mock.ts` | In-memory BullMQ |

---

## Implementation Steps

### Step 1: Vitest Configuration

```typescript
// apps/backend/vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['tests/setup/setup-file.ts'],
    globalSetup: ['tests/setup/global-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/*.d.ts'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
    // Project-based test separation
    projects: [
      {
        name: 'unit',
        test: {
          include: ['tests/unit/**/*.test.ts'],
          setupFiles: ['tests/setup/setup-file.ts'],
        },
      },
      {
        name: 'integration',
        test: {
          include: ['tests/integration/**/*.test.ts'],
          setupFiles: ['tests/setup/setup-file.ts'],
          hookTimeout: 60000,    // Testcontainers need time
          testTimeout: 30000,
        },
      },
      {
        name: 'e2e',
        test: {
          include: ['tests/e2e/**/*.test.ts'],
          setupFiles: ['tests/setup/setup-file.ts'],
          hookTimeout: 120000,
          testTimeout: 60000,
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@tests': path.resolve(__dirname, 'tests'),
    },
  },
});
```

### Step 2: Global Setup (Testcontainers)

```typescript
// tests/setup/global-setup.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';

let postgresContainer: any;
let redisContainer: any;

export async function setup() {
  // Start containers once for all tests
  postgresContainer = await new PostgreSqlContainer('pgvector/pgvector:pg16')
    .withDatabase('test')
    .withUsername('test')
    .withPassword('test')
    .start();

  redisContainer = await new RedisContainer('redis:7-alpine').start();

  // Set env vars for tests
  process.env.DATABASE_URL = postgresContainer.getConnectionUri();
  process.env.REDIS_URL = redisContainer.getConnectionUrl();

  // Enable pgvector extension
  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('CREATE EXTENSION IF NOT EXISTS vector');
  await client.end();

  // Return cleanup function
  return async () => {
    await postgresContainer.stop();
    await redisContainer.stop();
  };
}

export async function teardown() {
  // Handled by returned function from setup
}
```

### Step 3: Per-File Setup

```typescript
// tests/setup/setup-file.ts
import { beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Global Prisma client for tests
let prisma: PrismaClient;

beforeEach(async () => {
  prisma = new PrismaClient();

  // Clean tables before each test
  await prisma.chunk.deleteMany();
  await prisma.document.deleteMany();
});

afterEach(async () => {
  await prisma.$disconnect();
  vi.clearAllMocks();
});

export { prisma };
```

### Step 4: Fixture Helpers

```typescript
// tests/helpers/fixtures.ts
import { readFile } from 'fs/promises';
import path from 'path';

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');

export async function readFixture(relativePath: string): Promise<Buffer> {
  const fullPath = path.join(FIXTURES_DIR, relativePath);
  return readFile(fullPath);
}

export async function readFixtureText(relativePath: string): Promise<string> {
  const buffer = await readFixture(relativePath);
  return buffer.toString('utf-8');
}

export async function getExpected(name: string): Promise<string> {
  return readFixtureText(`expected/${name}`);
}

// File info for upload tests
export function getFixturePath(relativePath: string): string {
  return path.join(FIXTURES_DIR, relativePath);
}

export const FIXTURES = {
  pdf: {
    digital: 'pdfs/simple-digital.pdf',
    multiPage: 'pdfs/multi-page.pdf',
    passwordProtected: 'pdfs/password-protected.pdf',
    scanned: 'pdfs/scanned-image.pdf',
    corrupt: 'pdfs/corrupt.pdf',
  },
  json: {
    valid: 'json/valid.json',
    malformed: 'json/malformed.json',
  },
  text: {
    normal: 'text/normal.txt',
    unicode: 'text/unicode.txt',
    empty: 'text/empty.txt',
  },
  markdown: {
    withHeaders: 'markdown/with-headers.md',
    codeBlocks: 'markdown/code-blocks.md',
  },
} as const;
```

### Step 5: Deterministic Embedding Mock

```typescript
// tests/mocks/embedding-mock.ts
import { vi } from 'vitest';

/**
 * Generate deterministic 384d vector from text hash
 * Same text always produces same vector for test reproducibility
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}

export function mockEmbedding(text: string): number[] {
  const seed = hashCode(text);
  return Array.from({ length: 384 }, (_, i) =>
    Math.sin(seed + i) * 0.5
  );
}

/**
 * Create a mock embedder that returns deterministic vectors
 */
export function createMockEmbedder() {
  return {
    embed: vi.fn(async (text: string) => mockEmbedding(text)),
    embedBatch: vi.fn(async (texts: string[]) => texts.map(mockEmbedding)),
  };
}

/**
 * Mock the @xenova/transformers module
 */
export function mockTransformers() {
  vi.mock('@xenova/transformers', () => ({
    pipeline: vi.fn(async () => {
      return async (text: string, options?: { pooling?: string; normalize?: boolean }) => {
        return {
          data: new Float32Array(mockEmbedding(text)),
        };
      };
    }),
    env: {
      allowRemoteModels: true,
      allowLocalModels: true,
    },
  }));
}

// Pre-computed embeddings for common test phrases
export const KNOWN_EMBEDDINGS = {
  'hello world': mockEmbedding('hello world'),
  'test document content': mockEmbedding('test document content'),
  'search query': mockEmbedding('search query'),
};
```

### Step 6: Python Worker Mock

```typescript
// tests/mocks/python-worker-mock.ts
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Callback payload types (mirror CONTRACT.md)
interface ProcessingResult {
  markdown: string;
  pageCount: number;
  ocrApplied: boolean;
  processingTimeMs: number;
}

interface ProcessingError {
  code: string;
  message: string;
}

interface CallbackPayload {
  documentId: string;
  success: boolean;
  result?: ProcessingResult;
  error?: ProcessingError;
}

/**
 * Create success callback payload
 */
export function successCallback(documentId: string, options?: Partial<ProcessingResult>): CallbackPayload {
  return {
    documentId,
    success: true,
    result: {
      markdown: '# Test Document\n\nThis is test content extracted from PDF.',
      pageCount: 1,
      ocrApplied: false,
      processingTimeMs: 150,
      ...options,
    },
  };
}

/**
 * Create failure callback payload
 */
export function failureCallback(
  documentId: string,
  code: string,
  message: string
): CallbackPayload {
  return {
    documentId,
    success: false,
    error: { code, message },
  };
}

/**
 * Common error callbacks
 */
export const ERRORS = {
  passwordProtected: (docId: string) =>
    failureCallback(docId, 'PASSWORD_PROTECTED', 'PDF is password protected'),
  corrupt: (docId: string) =>
    failureCallback(docId, 'CORRUPT_FILE', 'Unable to parse PDF structure'),
  timeout: (docId: string) =>
    failureCallback(docId, 'TIMEOUT', 'Processing exceeded time limit'),
  ocrFailed: (docId: string) =>
    failureCallback(docId, 'OCR_FAILED', 'OCR engine failed to extract text'),
};

/**
 * Setup MSW server for mocking Python worker HTTP calls
 * Call server.listen() in beforeAll, server.close() in afterAll
 */
export function createWorkerMockServer() {
  const handlers = [
    // Mock the callback endpoint (not needed in most tests)
    // This is for when we're testing the callback handler itself
  ];

  return setupServer(...handlers);
}

/**
 * Simulate Python worker calling back to Node.js
 * Use this in integration tests to simulate worker completion
 */
export async function simulateWorkerCallback(
  baseUrl: string,
  payload: CallbackPayload
): Promise<Response> {
  return fetch(`${baseUrl}/internal/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
```

### Step 7: BullMQ Mock

```typescript
// tests/mocks/bullmq-mock.ts
import { vi } from 'vitest';
import { EventEmitter } from 'events';

interface MockJob<T = any> {
  id: string;
  name: string;
  data: T;
  opts: any;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  attemptsMade: number;
  failedReason?: string;
}

/**
 * In-memory BullMQ Queue mock for unit tests
 */
export class MockQueue<T = any> extends EventEmitter {
  name: string;
  jobs: Map<string, MockJob<T>> = new Map();
  private idCounter = 0;

  constructor(name: string) {
    super();
    this.name = name;
  }

  async add(jobName: string, data: T, opts?: any): Promise<MockJob<T>> {
    const id = String(++this.idCounter);
    const job: MockJob<T> = {
      id,
      name: jobName,
      data,
      opts: opts || {},
      status: 'waiting',
      attemptsMade: 0,
    };
    this.jobs.set(id, job);
    this.emit('added', job);
    return job;
  }

  async addBulk(jobs: Array<{ name: string; data: T; opts?: any }>): Promise<MockJob<T>[]> {
    return Promise.all(jobs.map(j => this.add(j.name, j.data, j.opts)));
  }

  async getJob(id: string): Promise<MockJob<T> | undefined> {
    return this.jobs.get(id);
  }

  async getJobs(statuses: string[]): Promise<MockJob<T>[]> {
    return Array.from(this.jobs.values())
      .filter(job => statuses.includes(job.status));
  }

  // Test helpers
  getAddedJobs(): MockJob<T>[] {
    return Array.from(this.jobs.values());
  }

  clear(): void {
    this.jobs.clear();
    this.idCounter = 0;
  }

  async close(): Promise<void> {
    this.clear();
  }
}

/**
 * In-memory BullMQ Worker mock for unit tests
 */
export class MockWorker<T = any> extends EventEmitter {
  name: string;
  processor: (job: MockJob<T>) => Promise<any>;
  isRunning = false;

  constructor(name: string, processor: (job: MockJob<T>) => Promise<any>) {
    super();
    this.name = name;
    this.processor = processor;
  }

  async run(): Promise<void> {
    this.isRunning = true;
  }

  async close(): Promise<void> {
    this.isRunning = false;
  }

  // Test helper: manually process a job
  async processJob(job: MockJob<T>): Promise<any> {
    job.status = 'active';
    try {
      const result = await this.processor(job);
      job.status = 'completed';
      this.emit('completed', job, result);
      return result;
    } catch (error: any) {
      job.attemptsMade++;
      job.status = 'failed';
      job.failedReason = error.message;
      this.emit('failed', job, error);
      throw error;
    }
  }
}

/**
 * Mock the bullmq module
 */
export function mockBullMQ() {
  vi.mock('bullmq', () => ({
    Queue: MockQueue,
    Worker: MockWorker,
    QueueEvents: class extends EventEmitter {},
  }));
}
```

### Step 8: Database Helper

```typescript
// tests/helpers/database.ts
import { PrismaClient } from '@prisma/client';

let prismaInstance: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }
  return prismaInstance;
}

export async function cleanDatabase(): Promise<void> {
  const prisma = getPrisma();
  // Order matters due to FK constraints
  await prisma.chunk.deleteMany();
  await prisma.document.deleteMany();
}

export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}

// Seed helpers for integration tests
export async function seedDocument(data: Partial<Parameters<typeof getPrisma>['prototype']['document']['create']>['data']) {
  const prisma = getPrisma();
  return prisma.document.create({
    data: {
      filename: 'test.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      format: 'pdf',
      lane: 'heavy',
      status: 'PENDING',
      filePath: '/tmp/test.pdf',
      md5Hash: 'abc123',
      ...data,
    } as any,
  });
}
```

### Step 9: API Test Client Helper

```typescript
// tests/helpers/api.ts
import Fastify, { FastifyInstance } from 'fastify';

let app: FastifyInstance | null = null;

/**
 * Create Fastify test client
 * Lazy-initialized, shared across tests in same file
 */
export async function getTestApp(): Promise<FastifyInstance> {
  if (!app) {
    // Import app factory (to be created in Phase 04)
    const { createApp } = await import('@/app');
    app = await createApp();
  }
  return app;
}

export async function closeTestApp(): Promise<void> {
  if (app) {
    await app.close();
    app = null;
  }
}

/**
 * Make authenticated request
 */
export function authHeaders(apiKey: string = 'test-api-key'): Record<string, string> {
  return {
    'X-API-Key': apiKey,
  };
}

/**
 * Inject helper for cleaner test syntax
 */
export async function inject(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  options?: {
    payload?: any;
    headers?: Record<string, string>;
    auth?: boolean;
  }
): Promise<any> {
  const app = await getTestApp();
  const headers = {
    ...(options?.auth !== false ? authHeaders() : {}),
    ...options?.headers,
  };

  const response = await app.inject({
    method,
    url,
    payload: options?.payload,
    headers,
  });

  return {
    status: response.statusCode,
    body: response.json(),
    headers: response.headers,
  };
}
```

### Step 10: Create Test Fixtures

```json
// tests/fixtures/json/valid.json
{
  "title": "Test Document",
  "content": "This is valid JSON content for testing the fast lane processing pipeline.",
  "metadata": {
    "author": "Test Author",
    "created": "2025-01-01"
  }
}
```

```txt
// tests/fixtures/text/normal.txt
This is a normal text file for testing.

It contains multiple paragraphs with sufficient content
to pass the quality gate minimum text length requirement.

The SchemaForge pipeline should process this file through
the fast lane since it's a simple text format.
```

```markdown
// tests/fixtures/markdown/with-headers.md
# Main Title

Introduction paragraph with enough content for chunking.

## Section One

Content under section one. This section discusses important topics
that need to be chunked appropriately for vector search.

### Subsection 1.1

Detailed content in subsection. The chunker should recognize
markdown structure and split at appropriate boundaries.

## Section Two

Another section with different content. Testing how the splitter
handles multiple sections and maintains context through overlap.
```

---

## Todo List

- [ ] Create `apps/backend/vitest.config.ts`
- [ ] Create `tests/setup/global-setup.ts`
- [ ] Create `tests/setup/setup-file.ts`
- [ ] Create `tests/helpers/fixtures.ts`
- [ ] Create `tests/helpers/database.ts`
- [ ] Create `tests/helpers/redis.ts`
- [ ] Create `tests/helpers/api.ts`
- [ ] Create `tests/mocks/embedding-mock.ts`
- [ ] Create `tests/mocks/python-worker-mock.ts`
- [ ] Create `tests/mocks/bullmq-mock.ts`
- [ ] Add test fixture files (PDFs, JSON, TXT, MD)
- [ ] Update `package.json` test scripts
- [ ] Verify `pnpm test:unit` runs (empty, no failures)
- [ ] Verify `pnpm test:integration` starts containers

---

## Success Criteria

1. `pnpm test:unit` completes in < 5 seconds (no I/O)
2. `pnpm test:integration` starts PostgreSQL & Redis containers
3. Test fixtures are accessible via helper functions
4. Mock embedder returns consistent vectors for same input
5. Coverage reporting generates HTML report

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Testcontainers slow startup | Use global setup (once per suite) |
| Docker not available in CI | Use GitHub Actions services instead |
| pgvector image pull issues | Pre-pull in CI setup step |

---

## Security Considerations

- Test fixtures contain no real sensitive data
- Test API keys hardcoded (not production secrets)
- Containers isolated to test network

---

## Next Steps

After completion, proceed to [Phase 02: Validation Layer (TDD)](./phase-02-validation-layer-tdd.md) to write validation tests first, then implement.
