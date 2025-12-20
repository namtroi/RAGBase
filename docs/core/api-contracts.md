# RAGBase Contracts

**Phase 1 interfaces. TDD reference.**

---

## 1. Core Entities

### Document

```typescript
type DocumentStatus = 
  | 'PENDING'     // Uploaded, waiting queue
  | 'PROCESSING'  // In worker
  | 'COMPLETED'   // Success
  | 'FAILED';     // Gave up after retries

type FileFormat = 'pdf' | 'json' | 'txt' | 'md';
type ProcessingLane = 'fast' | 'heavy';

interface Document {
  id: string;              // UUID
  filename: string;
  mimeType: string;
  fileSize: number;        // bytes
  format: FileFormat;
  lane: ProcessingLane;
  status: DocumentStatus;
  filePath: string;        // local storage path
  md5Hash: string;         // dedup
  retryCount: number;      // max 3
  failReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Chunk

```typescript
interface Chunk {
  id: string;              // UUID
  documentId: string;      // FK → Document
  content: string;         // text content
  chunkIndex: number;      // order in document
  embedding: number[];     // 384d vector
  metadata: ChunkMetadata;
  createdAt: Date;
}

interface ChunkMetadata {
  page?: number;           // PDF page
  heading?: string;        // extracted heading
  charStart: number;       // position in source
  charEnd: number;
}
```

---

## 2. Queue Job Payloads

### Node.js → Redis (BullMQ)

```typescript
// Job pushed to queue
interface ProcessingJob {
  documentId: string;
  filePath: string;
  format: FileFormat;
  config: ProcessingConfig;
}

interface ProcessingConfig {
  ocrMode: 'auto' | 'force' | 'never';
  ocrLanguages: string[];  // ['en', 'vi']
}
```

### Python → Node.js (HTTP Callback)

```typescript
// POST /internal/callback
interface ProcessingCallback {
  documentId: string;
  success: boolean;
  result?: ProcessingResult;
  error?: ProcessingError;
}

interface ProcessingResult {
  markdown: string;        // Docling output
  pageCount: number;
  ocrApplied: boolean;
  processingTimeMs: number;
}

interface ProcessingError {
  code: ErrorCode;
  message: string;
}

type ErrorCode =
  | 'PASSWORD_PROTECTED'
  | 'CORRUPT_FILE'
  | 'UNSUPPORTED_FORMAT'
  | 'OCR_FAILED'
  | 'TIMEOUT'
  | 'INTERNAL_ERROR';
```

---

## 3. API Contracts

### Upload

```typescript
// POST /api/documents
// Content-Type: multipart/form-data
// Body: file (binary), ocrMode? (string)

interface UploadResponse {
  id: string;
  filename: string;
  status: 'PENDING';
  format: FileFormat;
  lane: ProcessingLane;
}

// Errors
// 400: { error: 'INVALID_FORMAT', message: '...' }
// 400: { error: 'FILE_TOO_LARGE', message: '...' }
// 401: { error: 'UNAUTHORIZED' }
```

### Status

```typescript
// GET /api/documents/:id

interface DocumentStatusResponse {
  id: string;
  filename: string;
  status: DocumentStatus;
  retryCount: number;
  failReason?: string;
  chunkCount?: number;     // if COMPLETED
  createdAt: string;       // ISO
  updatedAt: string;
}
```

### Query

```typescript
// POST /api/query
interface QueryRequest {
  query: string;           // 1-1000 chars
  topK?: number;           // 1-100, default 5
}

interface QueryResponse {
  results: QueryResult[];
}

interface QueryResult {
  content: string;
  score: number;           // 0-1 cosine similarity
  documentId: string;
  metadata: ChunkMetadata;
}
```

### List Documents

```typescript
// GET /api/documents?status=COMPLETED&limit=20&offset=0

interface ListResponse {
  documents: DocumentSummary[];
  total: number;
}

interface DocumentSummary {
  id: string;
  filename: string;
  status: DocumentStatus;
  chunkCount?: number;
  createdAt: string;
}
```

---

## 4. Validation Schemas (Zod)

```typescript
import { z } from 'zod';

// Upload validation
export const UploadSchema = z.object({
  ocrMode: z.enum(['auto', 'force', 'never']).default('auto'),
});

// Query validation
export const QuerySchema = z.object({
  query: z.string().min(1).max(1000).trim(),
  topK: z.number().int().min(1).max(100).default(5),
});

// List validation
export const ListQuerySchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// Callback validation (internal)
export const CallbackSchema = z.object({
  documentId: z.string().uuid(),
  success: z.boolean(),
  result: z.object({
    markdown: z.string(),
    pageCount: z.number().int().positive(),
    ocrApplied: z.boolean(),
    processingTimeMs: z.number().positive(),
  }).optional(),
  error: z.object({
    code: z.enum([
      'PASSWORD_PROTECTED',
      'CORRUPT_FILE', 
      'UNSUPPORTED_FORMAT',
      'OCR_FAILED',
      'TIMEOUT',
      'INTERNAL_ERROR',
    ]),
    message: z.string(),
  }).optional(),
});
```

---

## 5. File Routing Rules

```typescript
// Determine processing lane
function getProcessingLane(mimeType: string, ext: string): ProcessingLane {
  const fastFormats = ['json', 'txt', 'md'];
  return fastFormats.includes(ext) ? 'fast' : 'heavy';
}

// Format detection
const FORMAT_MAP: Record<string, FileFormat> = {
  'application/pdf': 'pdf',
  'application/json': 'json',
  'text/plain': 'txt',
  'text/markdown': 'md',
};

// Rejection rules
const REJECTION_RULES = {
  maxFileSizeMB: 50,
  allowedFormats: ['pdf', 'json', 'txt', 'md'],
  minTextLength: 50,       // after extraction
  maxNoiseRatio: 0.8,      // reject if > 80% noise
};
```

---

## 6. Chunking Contract

```typescript
interface ChunkingConfig {
  chunkSize: number;       // 1000 chars
  chunkOverlap: number;    // 200 chars
  format: 'markdown';      // markdown-aware splitting
}

// Input: processed markdown from Docling
// Output: array of text chunks with metadata
interface ChunkingResult {
  chunks: ChunkData[];
}

interface ChunkData {
  content: string;
  index: number;
  metadata: ChunkMetadata;
}
```

---

## 7. Embedding Contract

```typescript
type EmbeddingProvider = 'self-hosted' | 'openai';

interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;           // 'Xenova/all-MiniLM-L6-v2'
  dimensions: number;      // 384
  batchSize: number;       // 50
}

// Input: array of text chunks
// Output: array of 384d vectors
interface EmbeddingResult {
  embeddings: number[][];  // [chunks.length][384]
}
```

---

## 8. Dashboard Auth

```typescript
// Simple password auth for Phase 1
// POST /api/auth/login
interface LoginRequest {
  password: string;
}

interface LoginResponse {
  token: string;           // Simple session token
  expiresAt: string;       // ISO
}

// All dashboard endpoints require header:
// Authorization: Bearer <token>
```
