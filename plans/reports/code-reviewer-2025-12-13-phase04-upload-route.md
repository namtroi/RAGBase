# Code Review: Phase 04 Upload Route & API Routes Integration

**Date:** 2025-12-13
**Reviewed By:** Code Reviewer Agent
**Scope:** Upload route implementation + Phase 04 API routes integration (TDD)
**Status:** IMPLEMENTATION COMPLETE with CRITICAL issues identified

---

## Executive Summary

Phase 04 implementation is **feature-complete** but has **CRITICAL production issues** that must be resolved before testing or deployment. All route handlers, middleware, and supporting infrastructure are implemented according to the TDD plan, but there are significant problems with:

1. **Prisma client lifecycle management** (connection leaks)
2. **SQL injection vulnerability** in search route (unsafe embedding string interpolation)
3. **Type safety issues** with path resolution (workspace configuration)
4. **Missing error recovery** and edge case handling
5. **Path traversal security** in file uploads

---

## Scope Analysis

**Files Reviewed:**
- `apps/backend/src/routes/documents/upload-route.ts` (125 lines)
- `apps/backend/src/routes/documents/status-route.ts` (52 lines)
- `apps/backend/src/routes/documents/list-route.ts` (46 lines)
- `apps/backend/src/routes/query/search-route.ts` (69 lines)
- `apps/backend/src/middleware/auth-middleware.ts` (25 lines)
- `apps/backend/src/app.ts` (30 lines)
- Supporting validators, services, and test infrastructure

**Lines of Code Analyzed:** 347 (routes + middleware)

**Review Focus:**
- Recent implementation (Phase 04 completion)
- Specification compliance against `phase-04-api-routes-integration-tdd.md`
- Security, error handling, type safety
- Prisma/database integration patterns

---

## Critical Issues

### 1. SQL INJECTION VULNERABILITY - Search Route

**Severity:** CRITICAL | **Type:** Security
**File:** `apps/backend/src/routes/query/search-route.ts:46`

```typescript
// VULNERABLE - Direct string interpolation
1 - (c.embedding <=> ${embeddingStr}::vector) as similarity
```

**Problem:** The embedding array is converted to a string and interpolated directly into the SQL query. Although Prisma's `$queryRaw` handles parameterization, the embedding value is still being constructed as a string which defeats the safety mechanism.

```typescript
// Current (VULNERABLE):
const embeddingStr = `[${queryEmbedding.join(',')}]`;
const results = await prisma.$queryRaw<...>`
  ... 1 - (c.embedding <=> ${embeddingStr}::vector) as similarity ...
`;
```

**Correct Approach:**
```typescript
// SAFE - Use Prisma parameter binding with proper typing
const results = await prisma.$queryRaw<...>`
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
```

**Impact:** While Prisma's template string syntax provides some protection, the manual string construction is a code smell that could be exploited if the embedding service is compromised or returns unexpected values.

---

### 2. PRISMA CLIENT LIFECYCLE LEAK - All Routes

**Severity:** CRITICAL | **Type:** Resource Management
**Affects:** `upload-route.ts`, `status-route.ts`, `list-route.ts`, `search-route.ts`

**Problem:** Each route creates a new `PrismaClient` instance per request and disconnects after the request. This pattern causes:

```typescript
// PROBLEMATIC pattern repeated in all routes:
const prisma = new PrismaClient();
try {
  // ... query logic ...
} finally {
  await prisma.$disconnect();  // ❌ Disconnects every request
}
```

**Issues:**
1. **Connection pool exhaustion** - PostgreSQL has a limited connection pool (default 20). Creating/destroying connections per request will exhaust it under load.
2. **Performance degradation** - Handshakes and teardowns have overhead (~10-50ms per request)
3. **Memory leaks** - Dangling connections if errors occur during disconnect
4. **Not idiomatic** - Prisma is designed as a singleton in applications

**Expected Pattern:**
```typescript
// src/services/prisma.ts - SINGLETON instance
let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
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

Then routes should use:
```typescript
import { getPrismaClient } from '@/services/prisma';

export async function uploadRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/documents', async (request, reply) => {
    const prisma = getPrismaClient();  // ✅ Reuse singleton
    // ... no disconnect needed per request ...
  });
}
```

**Fix Priority:** MUST fix before any testing with real load

---

### 3. PATH TRAVERSAL VULNERABILITY - Upload Route

**Severity:** HIGH | **Type:** Security
**File:** `apps/backend/src/routes/documents/upload-route.ts:86`

```typescript
const filePath = path.join(UPLOAD_DIR, `${md5Hash}-${filename}`);
await writeFile(filePath, buffer);
```

**Problem:** The `filename` comes from user-supplied multipart data. An attacker could upload a file with `filename: "../../../etc/passwd"` which would traverse directories:

```
UPLOAD_DIR=/tmp/uploads
filename=../../../etc/passwd
md5Hash=abc123
filePath = /tmp/uploads/abc123-../../../etc/passwd
// After path.join normalization: /etc/passwd ⚠️
```

**Correct Approach:**
```typescript
import { basename } from 'path';

// Sanitize filename - use only basename, reject if it contains path separators
const sanitizedFilename = basename(filename);

// Additional validation
if (sanitizedFilename !== filename || sanitizedFilename.length === 0) {
  return reply.status(400).send({
    error: 'INVALID_FILENAME',
    message: 'Filename contains invalid characters',
  });
}

// Store file using only hash (recommended) or sanitized name
const filePath = path.join(UPLOAD_DIR, md5Hash); // Simplest approach
await writeFile(filePath, buffer);
```

**Impact:** File system access to sensitive files or arbitrary file write

---

### 4. MISSING PRISMA SINGLETON CONFIGURATION

**Severity:** HIGH | **Type:** Architecture
**File:** `apps/backend/src/services/index.ts` and all routes

**Problem:** The codebase doesn't have a centralized Prisma instance management. Each route independently creates instances, making it impossible to:
- Monitor connection pool usage
- Implement graceful shutdown
- Coordinate database state during errors
- Support connection pooling correctly

**Missing Implementation:**
```typescript
// apps/backend/src/services/database.ts
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['error'],
    });
  }
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

// In app.ts onClose hook:
export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({...});

  app.addHook('onClose', async () => {
    await disconnectPrisma();
  });

  return app;
}
```

---

### 5. AUTH MIDDLEWARE - TIMING ATTACK VULNERABILITY

**Severity:** MEDIUM | **Type:** Security
**File:** `apps/backend/src/middleware/auth-middleware.ts:18`

```typescript
if (!apiKey || apiKey !== expectedKey) {
  reply.status(401).send({...});
  return;
}
```

**Problem:** Using `!==` operator for string comparison is vulnerable to timing attacks. The comparison time varies based on where the string differs, allowing attackers to infer valid prefixes.

**Correct Approach:**
```typescript
import { timingSafeEqual } from 'crypto';

const expectedKey = process.env.API_KEY;
const apiKey = request.headers['x-api-key'];

if (!apiKey || !expectedKey) {
  reply.status(401).send({...});
  return;
}

try {
  // Both strings must be same length
  if (Buffer.byteLength(apiKey as string) !== Buffer.byteLength(expectedKey)) {
    reply.status(401).send({...});
    return;
  }

  timingSafeEqual(
    Buffer.from(apiKey as string),
    Buffer.from(expectedKey)
  );
} catch (e) {
  reply.status(401).send({...});
  return;
}
```

**Impact:** Medium risk - timing-based API key extraction possible over network

---

## High Priority Findings

### 6. Missing Error Handling in File Upload

**Severity:** HIGH | **Type:** Error Handling
**File:** `apps/backend/src/routes/documents/upload-route.ts:85-87`

```typescript
// No error handling for disk I/O operations
await mkdir(UPLOAD_DIR, { recursive: true });
const filePath = path.join(UPLOAD_DIR, `${md5Hash}-${filename}`);
await writeFile(filePath, buffer);
```

**Issues:**
- File write could fail (disk full, permissions, etc.)
- mkdir could fail
- No rollback if file write succeeds but DB insert fails
- No cleanup of partial files

**Expected Pattern:**
```typescript
try {
  await mkdir(UPLOAD_DIR, { recursive: true });
} catch (error: any) {
  if (error.code !== 'EEXIST') {
    return reply.status(500).send({
      error: 'STORAGE_ERROR',
      message: 'Failed to create upload directory',
    });
  }
}

const filePath = path.join(UPLOAD_DIR, md5Hash); // Use hash only
try {
  await writeFile(filePath, buffer, { flag: 'wx' }); // Fail if exists
} catch (error: any) {
  return reply.status(500).send({
    error: 'STORAGE_ERROR',
    message: 'Failed to save file to disk',
  });
}

// Wrap DB transaction with file cleanup on failure
let document;
try {
  document = await prisma.document.create({
    data: { /* ... */ },
  });
} catch (error) {
  // Cleanup file on DB error
  try {
    await rm(filePath);
  } catch (rmError) {
    console.error('Failed to cleanup file:', rmError);
  }
  throw error;
}
```

---

### 7. Type Safety - Invalid Path Resolution

**Severity:** HIGH | **Type:** Configuration
**Affects:** All route files and middleware

**Problem:** TypeScript compiler can't resolve `@/services` and `@/validators` aliases:

```
src/app.ts(1,32): error TS2307: Cannot find module '@/services'
src/routes/documents/upload-route.ts(1,29): error TS2307: Cannot find module '@/services'
```

**Root Cause:** The workspace structure requires special tsconfig configuration:

**Current Config Issue:**
- `vitest.config.ts` has path aliases correctly defined
- But `tsconfig.json` in `apps/backend/` doesn't include them
- VSCode/IDE uses `tsconfig.json`, not `vitest.config.ts`

**Fix Required:**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@tests/*": ["../../tests/*"]
    }
  }
}
```

**Current Status:** Code works at runtime via Vitest, fails at compile time. This is documented but should be fixed for IDE support.

---

### 8. Embedding Service Global Instance

**Severity:** MEDIUM | **Type:** Resource Management
**File:** `apps/backend/src/routes/query/search-route.ts:6`

```typescript
const embeddingService = new EmbeddingService();
```

**Problem:** Creating global instance at module load means:
1. Model loads into memory immediately on app startup (5-10 seconds on first run)
2. Can't be garbage collected
3. No error recovery if model loading fails
4. Makes testing harder (mock can't be injected)

**Better Approach:**
```typescript
let embeddingService: EmbeddingService | null = null;

function getEmbeddingService(): EmbeddingService {
  if (!embeddingService) {
    embeddingService = new EmbeddingService();
  }
  return embeddingService;
}

export async function searchRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/query', async (request, reply) => {
    // ... validation ...
    const service = getEmbeddingService();
    const queryEmbedding = await service.embed(query);
  });
}
```

---

### 9. Missing Input Validation - Filename Sanitization

**Severity:** MEDIUM | **Type:** Validation
**File:** `apps/backend/src/routes/documents/upload-route.ts:37-44`

**Problem:** Filename is used without validation:

```typescript
const filename = data.filename;
const mimeType = data.mimetype;

const validation = validateUpload({
  filename,      // ❌ No sanitization
  mimeType,
  size: buffer.length,
});
```

**Issues:**
- Filename could be null or undefined
- Could be too long (exhausts filename length)
- Could contain special characters that break file operations
- Used in error responses without encoding (XSS if exposed in HTML context)

**Fix:**
```typescript
const filename = data.filename?.trim();
if (!filename || filename.length === 0 || filename.length > 255) {
  return reply.status(400).send({
    error: 'INVALID_FILENAME',
    message: 'Filename is missing or too long',
  });
}

// Validate characters allowed in filenames
const validNameRegex = /^[\w\s\-\.()[\]]{1,255}$/;
if (!validNameRegex.test(filename)) {
  return reply.status(400).send({
    error: 'INVALID_FILENAME',
    message: 'Filename contains invalid characters',
  });
}
```

---

## Medium Priority Improvements

### 10. Error Response Inconsistency

**Severity:** MEDIUM | **Type:** API Design
**Affects:** Multiple routes

**Problem:** Error responses have inconsistent structures:

```typescript
// upload-route.ts
reply.status(400).send({
  error: 'NO_FILE',
  message: 'No file uploaded',
});

// search-route.ts
reply.status(400).send({
  error: 'VALIDATION_ERROR',
  message: input.error.message,  // Zod error details
});

// status-route.ts
reply.status(400).send({
  error: 'INVALID_ID',
  message: 'Invalid document ID format',
});
```

**Expected Pattern:** Standardized error format:

```typescript
interface ErrorResponse {
  error: string;           // Error code
  message: string;         // User-friendly message
  details?: any;           // Additional context
  timestamp?: string;      // ISO timestamp
  requestId?: string;      // Correlation ID
}
```

---

### 11. No Request Validation - Missing Null Checks

**Severity:** MEDIUM | **Type:** Validation
**File:** `apps/backend/src/routes/documents/upload-route.ts:27-38`

```typescript
const data = await request.file();

if (!data) {
  return reply.status(400).send({
    error: 'NO_FILE',
    message: 'No file uploaded',
  });
}

const buffer = await data.toBuffer();
const filename = data.filename;        // ❌ Could be undefined
const mimeType = data.mimetype;        // ❌ Could be undefined
```

**Issues:**
- `data.filename` may be undefined if multipart is malformed
- `data.mimetype` may be undefined
- `data.toBuffer()` could fail (exceeds stream size before multipart limit)

**Fix:**
```typescript
const data = await request.file();

if (!data) {
  return reply.status(400).send({
    error: 'NO_FILE',
    message: 'No file uploaded',
  });
}

if (!data.filename) {
  return reply.status(400).send({
    error: 'INVALID_FILE',
    message: 'Filename missing in upload',
  });
}

if (!data.mimetype) {
  return reply.status(400).send({
    error: 'INVALID_FILE',
    message: 'Content-Type missing in upload',
  });
}

let buffer: Buffer;
try {
  buffer = await data.toBuffer();
} catch (error: any) {
  return reply.status(413).send({
    error: 'FILE_TOO_LARGE',
    message: error.message || 'File size exceeded limit',
  });
}
```

---

### 12. Missing Pagination Validation

**Severity:** MEDIUM | **Type:** Validation
**File:** `apps/backend/src/routes/documents/list-route.ts:7`

```typescript
const query = ListQuerySchema.parse(request.query);
```

**Problem:** Using `.parse()` throws on validation error instead of safe parsing. If `.parse()` throws, it's uncaught.

**Fix:**
```typescript
const query = ListQuerySchema.safeParse(request.query);

if (!query.success) {
  return reply.status(400).send({
    error: 'INVALID_QUERY',
    message: 'Invalid query parameters',
    details: query.error.flatten(),
  });
}

const { status, limit, offset } = query.data;
```

---

### 13. No Content-Type Response Header

**Severity:** LOW | **Type:** HTTP Headers
**Affects:** All routes

**Problem:** Routes return JSON without explicit `Content-Type: application/json`. While Fastify often sets it automatically, it's safer to be explicit:

```typescript
// All routes should be:
reply.type('application/json');
return reply.status(201).send({...});
```

---

## Positive Observations

### ✅ Good Practices Found

1. **Proper UUID Validation** - Status route uses Zod schema correctly
   ```typescript
   const ParamsSchema = z.object({
     id: z.string().uuid(),
   });
   ```

2. **Format Detection Strategy** - Good fallback logic (MIME type → extension)
   ```typescript
   const formatFromMime = getFormatFromMimeType(file.mimeType);
   if (formatFromMime) return formatFromMime;
   const ext = file.filename.split('.').pop();
   ```

3. **Lane Routing Logic** - Proper separation of concerns for fast/heavy processing
   ```typescript
   const lane = getProcessingLane(format);
   ```

4. **Database Querying** - Correct use of Prisma `select()` and `_count`
   ```typescript
   include: {
     _count: {
       select: { chunks: true },
     },
   },
   ```

5. **Auth Middleware Structure** - Good public route exemption list
   ```typescript
   const PUBLIC_ROUTES = ['/health', '/internal/callback'];
   if (PUBLIC_ROUTES.some(route => request.url.startsWith(route))) {
     return;
   }
   ```

6. **Hash Deduplication** - Correct MD5 implementation with proper error handling
   ```typescript
   const md5Hash = HashService.md5(buffer);
   const existing = await prisma.document.findUnique({
     where: { md5Hash },
   });
   ```

---

## Alignment with Phase 04 Plan

| Requirement | Status | Notes |
|------------|--------|-------|
| POST /api/documents | ✅ Implemented | Has security issues (#1, #3) |
| GET /api/documents/:id | ✅ Implemented | Good UUID validation |
| GET /api/documents | ✅ Implemented | Needs validation fix (#12) |
| POST /api/query | ✅ Implemented | Has SQL injection risk (#1) |
| Auth middleware | ✅ Implemented | Timing attack risk (#5) |
| File validation | ✅ Implemented | Missing filename sanitization (#9) |
| Database persistence | ✅ Implemented | Bad Prisma lifecycle (#2) |
| MD5 deduplication | ✅ Implemented | Correct implementation |
| Lane routing | ✅ Implemented | Correct implementation |
| 50MB file limit | ✅ Implemented | Enforced by fastify/multipart |

---

## Test Coverage Analysis

**Test Status:** Not runnable without Docker
- Tests defined: 36 integration tests across 5 test files
- Coverage target: 80%+ on routes
- Current blockers: Testcontainers requires Docker daemon

**Test Quality:** Tests follow TDD pattern correctly (RED → GREEN phases), but cannot verify actual pass/fail status.

---

## Recommended Actions (Priority Order)

### CRITICAL - Must fix before any testing/deployment:

1. **Fix Prisma client lifecycle** (#2)
   - Create `src/services/database.ts` with singleton pattern
   - Update all routes to use `getPrismaClient()`
   - Remove per-request disconnect
   - Add cleanup hook in `createApp()`

2. **Fix SQL injection in search route** (#1)
   - Remove string interpolation of embedding
   - Let Prisma handle parameter binding directly
   - Test with real pgvector operations

3. **Fix path traversal in file upload** (#3)
   - Use `basename()` to sanitize filename
   - Consider storing files by hash only
   - Add validation for filename characters

4. **Add Prisma singleton service** (#4)
   - Create centralized database service
   - Implement proper connection management
   - Add logging/monitoring

### HIGH - Fix before integration test runs:

5. **Fix timing attack in auth** (#5)
   - Use `timingSafeEqual` for API key comparison
   - Add length check first

6. **Add error handling to file operations** (#6)
   - Wrap `mkdir` and `writeFile` in try-catch
   - Implement file cleanup on DB error
   - Handle EEXIST gracefully

7. **Fix TypeScript path resolution** (#7)
   - Update `apps/backend/tsconfig.json`
   - Add baseUrl and paths configuration
   - Verify IDE can resolve imports

8. **Defer embedding service initialization** (#8)
   - Change from global instance to lazy singleton
   - Implement error recovery for model loading
   - Make testable with dependency injection

### MEDIUM - Fix before production:

9. **Add filename sanitization** (#9)
   - Validate filename length and characters
   - Reject path traversal patterns
   - Add comprehensive validation

10. **Standardize error responses** (#10)
    - Create error response interface
    - Ensure all routes return consistent format
    - Include error codes and details

11. **Use safeParse everywhere** (#12)
    - Replace `.parse()` with `.safeParse()`
    - Add proper error responses for validation failures

12. **Add explicit Content-Type** (#13)
    - Set `Content-Type: application/json` in all responses

---

## Security Checklist

- ❌ SQL Injection prevention - FAILED (#1 - embedding interpolation)
- ❌ Path traversal prevention - FAILED (#3 - filename not sanitized)
- ❌ Timing attack prevention - FAILED (#5 - string comparison)
- ❌ Input validation - PARTIAL (#9 - filename not validated)
- ✅ API key authentication - IMPLEMENTED (with timing attack caveat)
- ✅ File size limits - IMPLEMENTED
- ✅ UUID validation - IMPLEMENTED
- ⚠️  Error handling - INCOMPLETE (#6 - file I/O not handled)
- ✅ Dependency management - IMPLEMENTED (Prisma, Zod, Fastify)

---

## Performance Considerations

1. **Prisma connections** - Creating new client per request will timeout under load
2. **Embedding model** - Loading large ML model at startup (5-10s)
3. **Query optimization** - List route uses `Promise.all()` for count, good
4. **File I/O** - Blocking write in request handler acceptable for initial MVP

---

## Type Safety Metrics

- **Declared Strict:** TypeScript strict mode enabled
- **Runtime Type Checking:** Zod schemas for input validation
- **Database Types:** Prisma-generated types used
- **Path Aliases:** Broken at compile-time, work at runtime

---

## Unresolved Questions

1. **File storage location** - Should uploaded files be stored by hash-only name? Current approach stores `${md5Hash}-${filename}` which is 2x redundant since MD5 is already unique.

2. **Prisma singleton scope** - Should the singleton be request-scoped or application-scoped? Recommend application-scoped with proper cleanup on shutdown.

3. **Error recovery** - What should happen if file write succeeds but DB insert fails? Current code has no rollback mechanism.

4. **Embedding model caching** - Should embedding service persist model cache between restarts? Current implementation downloads on startup.

5. **File path configuration** - `UPLOAD_DIR` hardcoded to `/tmp/uploads`. Should this be configurable? Important for multi-instance deployments.

---

## Conclusion

**Phase 04 implementation is functionally complete** according to the TDD plan specification. All required endpoints, middleware, and routes are implemented and follow the expected patterns. However, **5 critical issues** must be resolved before any production use:

1. Prisma client lifecycle (resource leak)
2. SQL injection in search route
3. Path traversal in file uploads
4. Timing attack in auth
5. File I/O error handling

The codebase demonstrates good understanding of:
- TypeScript and Fastify
- Zod validation patterns
- Database modeling with Prisma
- Multipart file upload handling
- TDD testing approach

With the recommended fixes applied, this code will be production-ready for Phase 05 integration with BullMQ queue and callback handlers.

**Estimated fix time:** 4-6 hours for all critical and high-priority items
**Next phase:** Phase 05 - Queue & Callbacks Integration (see plans/2025-12-13-phase1-tdd-implementation/phase-05-queue-callbacks-integration-tdd.md)

