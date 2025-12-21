# RAGBase Code Standards

**Last Updated:** December 21, 2025 (Python 3.11 Phase 02 - Virtual Environment Setup)
**Coverage:** Backend API + Database patterns + Python guidelines

---

## 1. TypeScript Standards

### 1.1 Type Safety
- Strict mode enabled in `tsconfig.json`
- All functions must have explicit return types
- Use unions over `any` type
- Leverage Zod for runtime validation of external data

```typescript
// ✅ Good
async function getUserById(id: string): Promise<User | null> {
  return await db.user.findUnique({ where: { id } });
}

// ❌ Bad
async function getUserById(id: any) {
  return await db.user.findUnique({ where: { id } });
}
```

### 1.2 Error Handling
- Never swallow errors silently
- Use discriminated unions for error states
- Provide meaningful error messages

```typescript
// ✅ Good
try {
  await writeFile(filePath, buffer);
} catch (error: any) {
  if (error.code === 'EEXIST') {
    return reply.status(500).send({
      error: 'STORAGE_ERROR',
      message: 'File already exists on disk',
    });
  }
  throw error;
}

// ❌ Bad
try {
  await writeFile(filePath, buffer);
} catch (error) {
  console.log('Error'); // Swallowed
}
```

### 1.3 Async Patterns
- Use `async/await` over promise chains
- Always await async operations
- Use `Promise<void>` for fire-and-forget (rare)

```typescript
// ✅ Good
const result = await query();
const transformed = await transform(result);

// ❌ Bad
const result = query(); // Forgot await
await transform(result);
```

---

## 2. Fastify Route Patterns

### 2.1 Route Handler Structure
```typescript
export async function myRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/path', async (request, reply) => {
    // 1. Validate input
    // 2. Call business logic
    // 3. Return response
    // 4. Handle errors explicitly
  });
}
```

### 2.2 Error Response Format
All errors follow this contract:

```typescript
// Validation errors (400)
reply.status(400).send({
  error: 'VALIDATION_ERROR',
  message: 'Detailed message',
});

// Authentication errors (401)
reply.status(401).send({
  error: 'UNAUTHORIZED',
  message: 'Invalid or missing API key',
});

// Not found (404)
reply.status(404).send({
  error: 'NOT_FOUND',
  message: 'Resource not found',
});

// Server errors (500)
reply.status(500).send({
  error: 'STORAGE_ERROR',
  message: 'Detailed error message',
});

// Service unavailable (503)
reply.status(503).send({
  error: 'SERVICE_UNAVAILABLE',
  message: 'Service temporarily unavailable',
});
```

### 2.3 Status Code Conventions
| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Query results |
| 201 | Created | Document created |
| 400 | Validation error | Invalid file format |
| 401 | Authentication required | Missing API key |
| 404 | Not found | Document doesn't exist |
| 409 | Conflict | Duplicate file |
| 500 | Server error | File I/O error |
| 503 | Service unavailable | Embedding service down |

---

## 3. Database Patterns

### 3.1 Prisma Client Lifecycle (NEW: Phase 04)

**ALWAYS** use the singleton pattern:

```typescript
import { getPrismaClient } from '@/services/database';

// ✅ Good - Use singleton
const prisma = getPrismaClient();
const doc = await prisma.document.findUnique({ where: { id } });

// ❌ Bad - Creates multiple clients
const prisma = new PrismaClient();
const doc = await prisma.document.findUnique({ where: { id } });
```

**Why:**
- Single connection pool prevents exhaustion
- Handles graceful shutdown
- Environment-aware logging (dev vs prod)

**Shutdown in app.ts:**
```typescript
fastify.addHook('onClose', async () => {
  await disconnectPrisma();
});
```

### 3.2 Query Patterns

**Safe queries using Prisma methods:**
```typescript
// ✅ Good - Type-safe
const doc = await prisma.document.findUnique({
  where: { id },
  include: { chunks: true },
});

// ✅ Good - Raw query with parameter binding
const results = await prisma.$queryRaw`
  SELECT * FROM documents WHERE id = ${id}
`;
```

**Never concatenate user input:**
```typescript
// ❌ Bad - SQL injection risk
const results = await db.$queryRaw(
  `SELECT * FROM documents WHERE query = '${query}'`
);
```

### 3.3 Vector Search Pattern

Use parameterized queries for pgvector operations:

```typescript
const results = await prisma.$queryRaw<ChunkRow[]>`
  SELECT
    c.id,
    c.content,
    c.embedding,
    1 - (c.embedding <=> ${JSON.stringify(embedding)}::vector) as similarity
  FROM chunks c
  ORDER BY c.embedding <=> ${JSON.stringify(embedding)}::vector
  LIMIT ${topK}
`;
```

### 3.4 Transaction Patterns

```typescript
// ✅ Good - Transactional consistency
const result = await prisma.$transaction(async (tx) => {
  const doc = await tx.document.create({ data: {...} });
  // NOTE: Chunks use pgvector (Unsupported type), so we cannot use createMany.
  // We use a loop or Promise.all for small sets, or raw SQL for large sets.
  await Promise.all([
    tx.chunk.create({ data: { documentId: doc.id, ... } }),
    tx.chunk.create({ data: { documentId: doc.id, ... } }),
  ]);
  return doc;
});

// ❌ Bad - Not transactional AND uses unsupported createMany
const doc = await prisma.document.create({ data: {...} });
await prisma.chunk.createMany({ data: [...] });
```

---

## 4. Security Standards

### 4.1 Authentication (Timing-Safe Comparison)

**NEW: Phase 04**

Always use `crypto.timingSafeEqual()` for secret comparison:

```typescript
import { timingSafeEqual } from 'crypto';

// ✅ Good - Prevents timing attacks
const apiKeyBuffer = Buffer.from(apiKey, 'utf8');
const expectedKeyBuffer = Buffer.from(expectedKey, 'utf8');

if (apiKeyBuffer.length === expectedKeyBuffer.length) {
  try {
    timingSafeEqual(apiKeyBuffer, expectedKeyBuffer);
    isValid = true;
  } catch {
    isValid = false;
  }
}

// ❌ Bad - Timing attack vulnerability
if (apiKey === expectedKey) {
  isValid = true;
}
```

**Why:** Simple string comparison takes longer if more characters match, leaking information about the secret.

### 4.2 File Upload Security

**Path Traversal Protection (NEW: Phase 04)**

```typescript
import path, { basename } from 'path';

// ✅ Good - Prevents directory escape
const sanitizedFilename = basename(filename);
if (sanitizedFilename !== filename || sanitizedFilename.length > 255) {
  throw new Error('Invalid filename');
}

// Store using MD5 hash, not original filename
const filePath = path.join(UPLOAD_DIR, md5Hash);
await writeFile(filePath, buffer);

// ❌ Bad - Path traversal risk
const filePath = path.join(UPLOAD_DIR, filename); // "../../../etc/passwd"
```

**Why:**
- `basename()` removes all path separators
- MD5 hash ensures unique, collision-resistant storage
- 255 char limit prevents filesystem issues

### 4.3 Input Validation

**Use Zod with SafeParse:**

```typescript
import { z } from 'zod';

const QuerySchema = z.object({
  query: z.string().min(1).max(1000).trim(),
  topK: z.number().int().min(1).max(100).default(5),
});

// ✅ Good - Proper error handling
const input = QuerySchema.safeParse(request.body);
if (!input.success) {
  return reply.status(400).send({
    error: 'VALIDATION_ERROR',
    message: input.error.message,
  });
}

// ✅ Use validated data
const { query, topK } = input.data;

// ❌ Bad - No validation
const { query, topK } = request.body;
```

### 4.4 Database Error Handling with Cleanup

**File I/O Rollback Pattern (NEW: Phase 04)**

When file write succeeds but DB fails, clean up the file:

```typescript
// Save file first
try {
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(filePath, buffer, { flag: 'wx' });
} catch (error: any) {
  // Handle file I/O errors
  return reply.status(500).send({
    error: 'STORAGE_ERROR',
    message: error.message,
  });
}

// Create DB record with cleanup on failure
let document;
try {
  document = await prisma.document.create({ data: {...} });
} catch (error) {
  // Cleanup written file if DB fails
  await rm(filePath).catch(console.error);
  throw error;
}
```

---

## 5. Validation Standards

### 5.1 Upload Validation

```typescript
// apps/backend/src/validators/upload.ts
const UploadSchema = z.object({
  filename: z.string().max(255),
  mimeType: z.string(),
  size: z.number().max(50 * 1024 * 1024), // 50MB
});

// ✅ Good - Use SafeParse for HTTP errors
const validation = UploadSchema.safeParse({
  filename: request.file.filename,
  mimeType: request.file.mimetype,
  size: request.file.size,
});

if (!validation.success) {
  return reply.status(400).send({
    error: 'INVALID_FILE',
    message: validation.error.message,
  });
}
```

### 5.2 Query Validation

```typescript
// apps/backend/src/validators/query.ts
const QuerySchema = z.object({
  query: z.string().min(1).max(1000).trim(),
  topK: z.number().int().min(1).max(100).default(5),
});
```

### 5.3 Format Detection

```typescript
function detectFormat(filename: string): Format | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  const formatMap: Record<string, Format> = {
    pdf: 'pdf',
    docx: 'docx',
    xlsx: 'xlsx',
    json: 'json',
    txt: 'txt',
    md: 'md',
    csv: 'csv',
  };
  return formatMap[ext || ''] || null;
}
```

---

## 6. Error Handling Standards

### 6.1 Error Categories

| Type | Status | Recovery |
|------|--------|----------|
| **Validation** | 400 | User must correct input |
| **Authentication** | 401 | User must provide API key |
| **Not Found** | 404 | Resource doesn't exist |
| **Conflict** | 409 | Resolve conflict (e.g., duplicate) |
| **Server** | 500 | Unrecoverable, log & alert |
| **Unavailable** | 503 | Service down, retry later |

### 6.2 Logging Standards

```typescript
// Development mode: verbose
if (process.env.NODE_ENV === 'development') {
  prisma = new PrismaClient({
    log: ['query', 'warn', 'error'],
  });
}

// Production: errors only
else {
  prisma = new PrismaClient({
    log: ['error'],
  });
}
```

---

## 7. File I/O Standards

### 7.1 Safe File Operations

```typescript
import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';

// ✅ Good - Proper error handling
try {
  await mkdir(uploadDir, { recursive: true });
  await writeFile(filePath, buffer, { flag: 'wx' }); // Fail if exists
} catch (error: any) {
  if (error.code === 'EEXIST') {
    // Hash collision - rare but handle
    return reply.status(500).send({...});
  }
  // Unexpected error
  return reply.status(500).send({...});
}

// ✅ Cleanup on failure
try {
  await prisma.document.create({ data: {...} });
} catch (error) {
  await rm(filePath).catch(console.error);
  throw error;
}
```

### 7.2 File Path Construction

```typescript
// ✅ Good - Use path.join() + sanitized input
const filename = basename(userInput); // Remove path separators
const filePath = path.join(UPLOAD_DIR, md5Hash);

// ❌ Bad - String concatenation
const filePath = `${UPLOAD_DIR}/${userInput}`; // Vulnerable
```

---

## 8. Testing Standards

### 8.1 Unit Test Pattern

```typescript
describe('QuerySchema', () => {
  it('rejects empty query', () => {
    const result = QuerySchema.safeParse({ query: '' });
    expect(result.success).toBe(false);
  });

  it('rejects query > 1000 chars', () => {
    const result = QuerySchema.safeParse({
      query: 'a'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid query', () => {
    const result = QuerySchema.safeParse({
      query: 'search text',
    });
    expect(result.success).toBe(true);
    expect(result.data?.topK).toBe(5); // Default
  });
});
```

### 8.2 Integration Test Pattern

```typescript
describe('POST /api/documents', () => {
  it('returns 201 for valid file', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/documents',
      payload: formData,
      headers: { 'x-api-key': process.env.API_KEY },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toHaveProperty('id');
  });

  it('returns 400 for missing API key', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/documents',
      payload: formData,
      // Missing header
    });
    expect(response.statusCode).toBe(401);
  });

  it('returns 409 for duplicate file', async () => {
    // Upload once
    await app.inject({
      method: 'POST',
      url: '/api/documents',
      payload: formData,
      headers: { 'x-api-key': process.env.API_KEY },
    });

    // Upload same file again
    const response = await app.inject({
      method: 'POST',
      url: '/api/documents',
      payload: formData,
      headers: { 'x-api-key': process.env.API_KEY },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe('DUPLICATE_FILE');
  });
});
```

---

## 9. Naming Conventions

### 9.1 Files & Directories
- **Routes:** `*-route.ts` (e.g., `upload-route.ts`)
- **Services:** `*-service.ts` (e.g., `hash-service.ts`)
- **Middleware:** `*-middleware.ts` (e.g., `auth-middleware.ts`)
- **Tests:** `*.test.ts` (e.g., `upload-route.test.ts`)
- **Validators:** `*-validator.ts` or consolidated in `validators/index.ts`

### 9.2 Database Models
- **PascalCase** for model names: `Document`, `Chunk`, `User`
- **camelCase** for field names: `documentId`, `createdAt`, `md5Hash`
- **UPPER_SNAKE_CASE** for enums: `PENDING`, `COMPLETED`, `FAILED`

### 9.3 Error Codes
- **UPPER_SNAKE_CASE**: `VALIDATION_ERROR`, `UNAUTHORIZED`, `STORAGE_ERROR`
- Unique per error type
- Match HTTP semantics

### 9.4 Zod Schemas
- **PascalCase + "Schema"**: `QuerySchema`, `UploadSchema`, `ParamsSchema`
- Collocate with usage or in `validators/index.ts`

---

## 10. Documentation Standards

### 10.1 JSDoc Comments

```typescript
/**
 * Get or create Prisma Client singleton
 *
 * Prevents connection pool exhaustion from multiple instances.
 * Thread-safe pattern suitable for Fastify hooks.
 *
 * @returns {PrismaClient} Singleton instance
 * @see https://www.prisma.io/docs/guides/performance-and-optimization/connection-management
 */
export function getPrismaClient(): PrismaClient {
  // ...
}
```

### 10.2 Inline Comments

```typescript
// Only for WHY, not WHAT
// ✅ Good - Explains security decision
const apiKeyBuffer = Buffer.from(apiKey, 'utf8');
// Constant-time comparison prevents timing attacks

// ❌ Bad - Obvious from code
const apiKeyBuffer = Buffer.from(apiKey, 'utf8'); // Convert to buffer
```

### 10.3 README Standards

- Quick start (5 mins)
- Architecture overview
- Development workflow
- Common issues & solutions

---

## 11. Dependency Management

### 11.1 Core Dependencies
- **Framework:** `fastify` 4.x
- **Database:** `@prisma/client` (with schema-driven approach)
- **Validation:** `zod` 3.x
- **Testing:** `vitest`, `supertest`
- **Files:** Built-in `fs/promises`
- **Hashing:** Built-in `crypto`

### 11.2 Version Pinning
Pin major versions in `package.json`:
```json
{
  "fastify": "^4.24.0",
  "@prisma/client": "^5.7.0",
  "zod": "^3.22.0"
}
```

---

## 12. Performance Standards

### 12.1 Connection Pooling
- Use Prisma singleton (prevents pool exhaustion)
- Default pool size: 5-10 (config via `DATABASE_URL`)
- Monitor active connections in production

### 12.2 Query Optimization
- Use indexes on frequently queried columns
- Batch operations where possible
- Avoid N+1 queries (use `include` in Prisma)

### 12.3 File I/O
- Stream large files (Phase 05+)
- Use `{ flag: 'wx' }` to prevent overwrite
- Set `UPLOAD_DIR` with sufficient disk space

---

## 13. Checklist for New Features

- [ ] TypeScript types all present
- [ ] Error handling covers happy + error paths
- [ ] Validation uses SafeParse + proper status codes
- [ ] Prisma singleton used (not new PrismaClient)
- [ ] Input sanitization applied (filenames, SQL)
- [ ] Tests written (unit + integration)
- [ ] Error responses follow contract
- [ ] JSDoc comments added
- [ ] No console.log (use Prisma logging in dev)
- [ ] Database operations transactional where needed

---

## 14. Python Standards (ai-worker)

### 14.1 Python Version

**Current State (Phase 02 - Dec 21, 2025):**
- System Python: 3.10.12 (unchanged)
- Python 3.11: 3.11.0rc1 (installed in Phase 01)
- venv: `.venv` with Python 3.11.0rc1 (created in Phase 02)
- Upgrade Plan: See [Python 3.11 Upgrade](./python-311-upgrade.md)

**For Developers:**
```bash
# Check system Python
python3 --version
# Output: Python 3.10.12

# Check Python 3.11 system install
python3.11 --version
# Output: Python 3.11.0rc1

# Check development venv (after activation)
cd apps/ai-worker
source .venv/bin/activate
python --version
# Output: Python 3.11.0rc1
```

### 14.2 Virtual Environment Setup (Phase 02 - Active)

**Main Development Environment (Python 3.11):**

```bash
# Navigate to ai-worker
cd apps/ai-worker

# Activate the Python 3.11 venv (already created)
source .venv/bin/activate

# Verify activation
python --version
# Output: Python 3.11.0rc1

# Verify all 130 packages installed
pip list | wc -l
# Output: 132 (pip + setuptools + 130 packages)
```

**Legacy Environment (Python 3.10, optional):**

```bash
# Create separate venv for compatibility testing if needed
python3 -m venv venv-py310-legacy
source venv-py310-legacy/bin/activate
pip install -r requirements.txt
```

### 14.3 Dependency Management (Phase 02 - Installed)

**Location:** `apps/ai-worker/` (requirements files + `.venv/`)

**Phase 02 Status:** All 130 packages installed in `.venv`

**Installation (already complete):**
```bash
cd apps/ai-worker
source .venv/bin/activate
# Dependencies pre-installed - verify with:
pip list
```

**If reinstalling is needed:**
```bash
# Install core dependencies
pip install -r requirements.txt

# Install production heavy dependencies
pip install -r requirements-prod.txt

# Install development/testing dependencies
pip install -r requirements-dev.txt
```

**Core Dependency Categories:**

*Framework & Server (5 packages):*
- fastapi==0.126.0 (async web framework)
- uvicorn==0.38.0 (ASGI server)
- pydantic-settings==2.12.0 (config management)
- httpx==0.28.0 (HTTP client)
- structlog==24.4.0 (structured logging)

*Document Processing (2 packages):*
- docling==2.15.0 (document structure extraction, ~500MB)
- pymupdf==1.26.0 (PDF processing)

*Queue Integration (2 packages):*
- bullmq==2.18.1 (BullMQ Python client)
- redis>=5.0.0 (Redis client)

*Testing Framework (4 packages):*
- pytest==8.3.4 (test runner)
- pytest-asyncio==0.25.0 (async test support)
- pytest-cov==6.0.0 (coverage reporting)
- httpx[test] (test client)

*Transitive Dependencies (117+ packages):*
- numpy, scipy, PIL, lxml, etc. (heavy ML/document processing deps)

### 14.4 Code Style

- **Linting:** Use `pylint` or `ruff` (configured in pyproject.toml)
- **Formatting:** Use `black` (88 char line length)
- **Type hints:** Always include type hints (PEP 484)

```python
# ✅ Good - Type hints provided
async def process_document(file_path: str, timeout: int = 30) -> dict[str, Any]:
    """Process a document and return metadata."""
    result = await docling_processor.process(file_path)
    return {
        'status': 'success',
        'file_size': len(result.content),
        'chunks': result.chunk_count,
    }

# ❌ Bad - Missing type hints
async def process_document(file_path, timeout=30):
    result = docling_processor.process(file_path)
    return result
```

### 14.5 Async Patterns

Always use async/await for I/O-bound operations:

```python
# ✅ Good - Async throughout
async def upload_handler(request: Request) -> JSONResponse:
    file_content = await request.body()
    result = await process_async(file_content)
    await db.save(result)
    return JSONResponse({'status': 'ok'})

# ❌ Bad - Blocking I/O
def upload_handler(request: Request) -> JSONResponse:
    file_content = request.body()  # Blocking
    result = process_sync(file_content)  # Blocking
    return JSONResponse({'status': 'ok'})
```

### 14.6 Error Handling

```python
from fastapi import HTTPException
from pydantic import ValidationError

# ✅ Good - Specific error handling
@app.post('/process')
async def process(request: DocumentRequest) -> ProcessResponse:
    try:
        validated = DocumentSchema(**request.dict())
    except ValidationError as e:
        raise HTTPException(
            status_code=400,
            detail={'error': 'VALIDATION_ERROR', 'message': str(e)}
        )

    try:
        result = await process_document(validated.file_path)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail={'error': 'FILE_NOT_FOUND', 'message': 'Document not found'}
        )

    return ProcessResponse(**result)

# ❌ Bad - Silent failures
@app.post('/process')
async def process(request):
    try:
        result = process_document(request.file_path)
    except Exception:
        pass  # Swallowed
    return result
```

### 14.7 Documentation Standards

Use docstrings for all functions:

```python
def calculate_similarity(
    embedding_1: list[float],
    embedding_2: list[float],
    metric: str = 'cosine'
) -> float:
    """
    Calculate similarity between two embeddings.

    Args:
        embedding_1: First embedding vector (384d for all-MiniLM-L6-v2)
        embedding_2: Second embedding vector
        metric: Similarity metric ('cosine', 'euclidean', 'dot')

    Returns:
        Similarity score (0.0 to 1.0 for cosine distance)

    Raises:
        ValueError: If embeddings have different dimensions
        ValueError: If metric is not supported
    """
```

### 14.8 Testing

Location: `apps/ai-worker/tests/`

```python
import pytest
from fastapi.testclient import TestClient
from app import app

@pytest.fixture
def client():
    return TestClient(app)

def test_process_valid_document(client):
    """Test processing valid PDF document."""
    response = client.post(
        '/process',
        json={'file_path': '/tmp/test.pdf', 'timeout': 30}
    )
    assert response.status_code == 200
    assert response.json()['status'] == 'success'

def test_process_invalid_format(client):
    """Test processing unsupported format."""
    response = client.post(
        '/process',
        json={'file_path': '/tmp/test.bin', 'timeout': 30}
    )
    assert response.status_code == 400
    assert response.json()['error'] == 'INVALID_FORMAT'
```

### 14.9 Logging

Use structlog for structured logging:

```python
import structlog

logger = structlog.get_logger()

async def process_queue_message(message: Message) -> None:
    """Process message from BullMQ queue."""
    logger.info('process_start', message_id=message.id, type=message.type)

    try:
        result = await docling.process(message.file_path)
        logger.info('process_complete', duration_ms=message.duration)
    except Exception as error:
        logger.error(
            'process_failed',
            error_type=type(error).__name__,
            error_message=str(error)
        )
        raise
```

### 14.10 Checklist for Python Features

- [ ] Python version compatible (3.10.12 or 3.11.0rc1)
- [ ] Type hints on all functions
- [ ] Async/await used for I/O operations
- [ ] Error handling covers normal + error paths
- [ ] Structured logging with structlog
- [ ] Docstrings on all public functions
- [ ] Tests written (unit + integration)
- [ ] No blocking operations in async context
- [ ] Dependencies listed in requirements.txt
- [ ] venv used for dependency isolation
