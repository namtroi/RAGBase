# Phase 04 - Critical Fixes Recommended

## Overview

The Phase 04 implementation is **feature-complete but NOT production-ready**. This document provides prioritized fix recommendations with code examples.

---

## PRIORITY 1: Prisma Client Singleton (2 hours)

### Issue
Every request creates a new PrismaClient and disconnects after, causing:
- Connection pool exhaustion (default 20 connections)
- Performance degradation (10-50ms per request)
- Memory leaks on error
- Violates Prisma best practices

### Files Affected
- `upload-route.ts:67`
- `status-route.ts:20`
- `list-route.ts:8`
- `search-route.ts:26`

### Implementation

**Step 1: Create singleton service** (`apps/backend/src/services/database.ts`)

```typescript
import { PrismaClient } from '@prisma/client';

let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['error'],
    });
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

**Step 2: Update app.ts**

```typescript
import { disconnectPrisma } from '@/services/database';

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({...});

  app.addHook('onClose', async () => {
    await disconnectPrisma();
  });

  return app;
}
```

**Step 3: Update all routes**

Replace `new PrismaClient()` with `getPrismaClient()` and remove disconnect calls.

---

## PRIORITY 2: Fix SQL Injection (30 min)

### Issue
Embedding array converted to string and interpolated in SQL

### Fix Location
`apps/backend/src/routes/query/search-route.ts:46`

### Solution
Remove string interpolation, pass embedding directly to Prisma:

```typescript
// OLD - VULNERABLE:
const embeddingStr = `[${queryEmbedding.join(',')}]`;
const results = await prisma.$queryRaw`
  ... 1 - (c.embedding <=> ${embeddingStr}::vector) as similarity ...
`;

// NEW - SAFE:
const results = await prisma.$queryRaw`
  ... 1 - (c.embedding <=> ${queryEmbedding}::vector) as similarity ...
`;
```

---

## PRIORITY 3: Fix Path Traversal (1 hour)

### Issue
Filename not sanitized, allows `../../../etc/passwd` attacks

### Fix Location
`apps/backend/src/routes/documents/upload-route.ts:86`

### Solution

```typescript
import { basename } from 'path';

// Validate filename
const sanitizedFilename = basename(filename);
if (sanitizedFilename !== filename) {
  return reply.status(400).send({
    error: 'INVALID_FILENAME',
    message: 'Filename contains invalid path',
  });
}

// Use hash-only for storage (MD5 is unique)
const filePath = path.join(UPLOAD_DIR, md5Hash);
```

---

## PRIORITY 4: Fix Timing Attack (30 min)

### Issue
API key compared with `!==` operator (not constant-time)

### Fix Location
`apps/backend/src/middleware/auth-middleware.ts:18`

### Solution

```typescript
import { timingSafeEqual } from 'crypto';

// Check length first
if (Buffer.byteLength(apiKey) !== Buffer.byteLength(expectedKey)) {
  reply.status(401).send({error: 'UNAUTHORIZED'});
  return;
}

// Use constant-time comparison
try {
  timingSafeEqual(Buffer.from(apiKey), Buffer.from(expectedKey));
} catch (e) {
  reply.status(401).send({error: 'UNAUTHORIZED'});
  return;
}
```

---

## PRIORITY 5: Add File I/O Error Handling (1 hour)

### Issue
No error handling for disk I/O operations

### Fix Location
`apps/backend/src/routes/documents/upload-route.ts:84-112`

### Solution

```typescript
// Wrap file operations in try-catch
try {
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(filePath, buffer, { flag: 'wx' });
} catch (error: any) {
  return reply.status(500).send({
    error: 'STORAGE_ERROR',
    message: error.message,
  });
}

// Cleanup file if DB insert fails
try {
  document = await prisma.document.create({...});
} catch (error) {
  await rm(filePath).catch(console.error);
  throw error;
}
```

---

## Implementation Order

1. Create database singleton
2. Update all routes to use singleton
3. Fix SQL injection in search route
4. Fix path traversal in upload route
5. Fix timing attack in auth middleware
6. Add file I/O error handling
7. Run type check: `pnpm tsc --noEmit`
8. Run lint: `pnpm lint`

**Total Time:** 4-6 hours for all fixes

See full review: `plans/reports/code-reviewer-2025-12-13-phase04-upload-route.md`
