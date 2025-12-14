# SchemaForge Codebase Summary

**Last Updated:** Phase 04 Critical Fixes (Dec 2024)
**Token Compaction:** 24,627 tokens (102,707 chars)

---

## 1. Project Structure

```
SchemaForge/
├── apps/
│   ├── backend/                    # Node.js + Fastify API
│   │   ├── src/
│   │   │   ├── app.ts              # Fastify initialization
│   │   │   ├── middleware/
│   │   │   │   └── auth-middleware.ts   # Timing-safe API key validation
│   │   │   ├── services/
│   │   │   │   ├── database.ts     # Prisma singleton (NEW: Phase 04)
│   │   │   │   ├── hash-service.ts # MD5 hashing
│   │   │   │   └── embedding-service.ts # Vector embeddings
│   │   │   └── routes/
│   │   │       ├── documents/
│   │   │       │   ├── upload-route.ts      # File upload + path traversal protection
│   │   │       │   ├── status-route.ts      # Document status with Prisma singleton
│   │   │       │   └── list-route.ts        # List documents with SafeParse validation
│   │   │       ├── query/
│   │   │       │   └── search-route.ts      # Vector search with parameterized queries
│   │   │       └── health-route.ts          # Health check endpoint
│   │   ├── prisma/
│   │   │   └── schema.prisma       # Database schema
│   │   └── vitest.config.ts        # Test configuration
│   └── ai-worker/                  # Python worker (Phase 07)
├── tests/
│   ├── helpers/
│   │   └── api.ts                  # API test utilities
│   ├── integration/
│   │   ├── middleware/
│   │   │   └── auth-middleware.test.ts
│   │   └── routes/
│   │       ├── search-route.test.ts        # SQL injection prevention tests
│   │       ├── upload-route.test.ts        # Path traversal tests
│   │       └── status-route.test.ts
│   ├── setup/
│   │   └── global-setup.ts         # Test environment setup
│   └── fixtures/                   # Test data
├── docker/                         # Dockerfiles
├── docs/                           # Documentation (this directory)
└── plans/                          # Implementation plans

```

---

## 2. Core Services

### 2.1 Database Service (NEW: Phase 04)
**File:** `apps/backend/src/services/database.ts`

Implements **Prisma Client singleton** pattern to prevent connection pool exhaustion:

```typescript
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
```

**Why:** Multiple PrismaClient instances exhaust connection pool. Singleton ensures:
- Single connection pool across app
- Clean shutdown via `disconnectPrisma()`
- Environment-aware logging

**Adopted by:**
- `status-route.ts` (document queries)
- `upload-route.ts` (duplicate check)
- `search-route.ts` (vector search)
- `list-route.ts` (document listing)

### 2.2 Hash Service
**File:** `apps/backend/src/services/hash-service.ts`

Provides MD5 hashing for file deduplication. Used in `upload-route.ts` for:
- Detecting duplicate files
- Generating unique storage paths (prevents filename collisions)

### 2.3 Embedding Service
**File:** `apps/backend/src/services/embedding-service.ts`

Generates vector embeddings for text. Used in `search-route.ts` for similarity search.

---

## 3. Authentication & Security

### 3.1 Timing-Safe Auth Middleware (Phase 04)
**File:** `apps/backend/src/middleware/auth-middleware.ts`

Prevents **timing attack** on API key comparison:

```typescript
// Constant-time comparison using crypto.timingSafeEqual
if (apiKeyBuffer.length === expectedKeyBuffer.length) {
  try {
    timingSafeEqual(apiKeyBuffer, expectedKeyBuffer);
    isValid = true;
  } catch {
    isValid = false;
  }
}
```

**Public Routes (no auth required):**
- `/health` - Health check
- `/internal/callback` - Worker callback endpoint

**All other routes** require `X-API-Key` header.

### 3.2 Path Traversal Protection (Phase 04)
**File:** `apps/backend/src/routes/documents/upload-route.ts`

Prevents directory traversal attacks:

```typescript
// Validate filename with basename() + length check
const sanitizedFilename = basename(filename);
if (sanitizedFilename !== filename || sanitizedFilename.length === 0 || sanitizedFilename.length > 255) {
  return reply.status(400).send({
    error: 'INVALID_FILENAME',
    message: 'Filename contains invalid characters or exceeds length limit',
  });
}

// Store using MD5 hash only (prevents path traversal)
const filePath = path.join(UPLOAD_DIR, md5Hash);
```

**Why:**
- `basename()` removes path separators
- MD5 hash storage prevents arbitrary filesystem paths
- Length limit (255 chars) prevents filesystem issues

### 3.3 SQL Injection Prevention (Phase 04)
**File:** `apps/backend/src/routes/query/search-route.ts`

Prevents SQL injection in pgvector queries:

```typescript
const results = await prisma.$queryRaw<...>`
  SELECT ... FROM chunks c
  ORDER BY c.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
  LIMIT ${topK}
`;
```

**Why:** Prisma `$queryRaw` with template literals provides automatic parameter binding. Never concatenates user input directly.

---

## 4. API Routes

### 4.1 File Upload
**Route:** `POST /api/documents`
**File:** `apps/backend/src/routes/documents/upload-route.ts`

**Flow:**
1. Validate file size (50MB max)
2. Detect format (pdf, docx, xlsx, json, txt, md, csv)
3. Validate filename (no path traversal)
4. Calculate MD5 hash
5. Check for duplicates via Prisma singleton
6. Save file using MD5 hash path
7. Create document record with file I/O error handling + rollback
8. Queue job (mock for now)

**Error Handling:**
- 400: Invalid file, unsupported format, path traversal attempt
- 409: Duplicate file detected
- 500: Storage error (with DB cleanup on failure)

**New Features (Phase 04):**
- File I/O rollback on DB failure (cleanup written file)
- Path traversal protection via `basename()` + MD5 hash
- Prisma singleton for connection efficiency

### 4.2 Document Status
**Route:** `GET /api/documents/:id`
**File:** `apps/backend/src/routes/documents/status-route.ts`

Returns document metadata including chunk count (when completed).

**New Features (Phase 04):**
- SafeParse validation for UUID format
- Prisma singleton for queries
- Proper 400 vs 404 error codes

### 4.3 Document Listing
**Route:** `GET /api/documents`
**File:** `apps/backend/src/routes/documents/list-route.ts`

Lists all documents with pagination support.

**New Features (Phase 04):**
- SafeParse validation for query parameters
- Proper error handling (400 for validation, 500 for server errors)

### 4.4 Vector Search
**Route:** `POST /api/query`
**File:** `apps/backend/src/routes/query/search-route.ts`

Semantic search across document chunks.

**Request Body:**
```json
{
  "query": "search text",
  "topK": 5
}
```

**Response:**
```json
{
  "results": [
    {
      "content": "chunk text",
      "score": 0.85,
      "documentId": "uuid",
      "metadata": {
        "charStart": 0,
        "charEnd": 100,
        "page": 1,
        "heading": "Section Title"
      }
    }
  ]
}
```

**New Features (Phase 04):**
- SQL injection prevention via Prisma parameter binding
- Proper 400 vs 503 error codes (validation vs service errors)

### 4.5 Health Check
**Route:** `GET /health`
**File:** `apps/backend/src/routes/health-route.ts`

No authentication required. Returns `{"status":"ok"}`.

---

## 5. Validation Layer

**File:** `apps/backend/src/validators/index.ts` (via Zod)

### 5.1 Upload Validation
- File size ≤ 50MB
- Supported formats: pdf, docx, xlsx, json, txt, md, csv
- Mime type matching

### 5.2 Query Validation
```typescript
const QuerySchema = z.object({
  query: z.string().min(1).max(1000).trim(),
  topK: z.number().int().min(1).max(100).default(5),
});
```

All routes use **SafeParse** for proper error responses (400 with detailed messages).

---

## 6. Database Schema (Prisma)

**File:** `apps/backend/prisma/schema.prisma`

### Core Models

**Document**
- `id` (UUID, PK)
- `filename` (String)
- `mimeType` (String)
- `fileSize` (Int)
- `format` (Enum: pdf, docx, xlsx, json, txt, md, csv)
- `lane` (Enum: FAST, HEAVY)
- `status` (Enum: PENDING, PROCESSING, COMPLETED, FAILED)
- `filePath` (String) - MD5-hashed path
- `md5Hash` (String, unique index) - Deduplication
- `retryCount` (Int, default: 0)
- `failReason` (String, nullable)
- `createdAt`, `updatedAt` (DateTime)
- Relations: `chunks` (1-to-many)

**Chunk**
- `id` (UUID, PK)
- `documentId` (UUID, FK)
- `content` (String) - Chunk text
- `embedding` (Vector 384d) - pgvector type
- `charStart`, `charEnd` (Int) - Character position in original
- `page` (Int, nullable) - Page number
- `heading` (String, nullable) - Markdown heading
- Relations: `document` (many-to-1)

---

## 7. Test Infrastructure

### 7.1 Test Helpers
**File:** `tests/helpers/api.ts`

Provides utilities for:
- Setting up test server
- Making authenticated API requests
- Mocking worker responses

### 7.2 Global Setup
**File:** `tests/setup/global-setup.ts`

Initializes:
- Testcontainers (PostgreSQL + Redis)
- Database migrations
- Test environment variables

### 7.3 Integration Tests

**Path Traversal Tests** (`upload-route.test.ts`):
- Reject filenames with path separators
- Reject filenames exceeding 255 chars

**SQL Injection Tests** (`search-route.test.ts`):
- Verify parameterized query execution
- Test pgvector query safety

**Timing Attack Tests** (auth-middleware.test.ts):
- Verify constant-time comparison
- Test public route bypass

---

## 8. Configuration

### Environment Variables

**Database:**
- `DATABASE_URL` - PostgreSQL connection string

**File Storage:**
- `UPLOAD_DIR` - Directory for file uploads (default: `/tmp/uploads`)

**Security:**
- `API_KEY` - Shared secret for API authentication
- `NODE_ENV` - development or production (affects logging)

**Processing:**
- `REDIS_URL` - Redis connection (Phase 05+)

---

## 9. Error Handling Patterns

### Validation Errors (400)
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Detailed validation issue"
}
```

### Authentication Errors (401)
```json
{
  "error": "UNAUTHORIZED",
  "message": "Invalid or missing API key"
}
```

### Not Found (404)
```json
{
  "error": "NOT_FOUND",
  "message": "Document not found"
}
```

### Server Errors (500)
```json
{
  "error": "STORAGE_ERROR",
  "message": "Failed to save file: ..."
}
```

### Service Unavailable (503)
```json
{
  "error": "EMBEDDING_SERVICE_ERROR",
  "message": "Failed to generate query embedding: ..."
}
```

---

## 10. Development Workflow

### Running Tests
```bash
# All tests
pnpm test

# Watch mode
pnpm test:watch

# Integration only
pnpm test:integration

# Coverage
pnpm test:coverage
```

### Database Operations
```bash
# Generate Prisma client
pnpm --filter @schemaforge/backend db:generate

# Push schema to DB
pnpm --filter @schemaforge/backend db:push

# Create migration
pnpm --filter @schemaforge/backend db:migrate
```

### Development Server
```bash
# Start services (Docker required)
docker compose up -d

# Run server
pnpm dev

# Verify health
curl http://localhost:3000/health
```

---

## 11. Key Design Decisions (Phase 04)

| Decision | Rationale | Implementation |
|----------|-----------|-----------------|
| **Prisma Singleton** | Prevent connection pool exhaustion | `services/database.ts` |
| **Timing-Safe Auth** | Prevent timing attacks on API key | `crypto.timingSafeEqual()` |
| **Path Traversal Protection** | Prevent directory escape attacks | `basename()` + MD5 hash storage |
| **SQL Injection Prevention** | Use parameterized queries | Prisma `$queryRaw` with template literals |
| **File I/O Rollback** | Maintain consistency if DB fails | Cleanup written files on DB errors |
| **SafeParse Validation** | Proper error codes (400 vs 500) | Zod `safeParse()` in all routes |
| **MD5 Hash Storage** | Unique, collision-resistant paths | `HashService.md5()` for filenames |

---

## 12. Next Phases

- **Phase 05:** Queue integration (BullMQ) with proper job retry logic
- **Phase 06:** E2E pipeline testing with Docling processing
- **Phase 07:** Python AI Worker integration
- **Phase 08:** Frontend UI (React + Vite)
- **Phase 09:** Production hardening & scaling
