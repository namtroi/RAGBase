# RAGBase API Contracts

**Phase 3 Complete** | **TDD Reference & Integration Spec**

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
type SourceType = 'MANUAL' | 'DRIVE';

interface Document {
  id: string;              // UUID
  filename: string;
  mimeType: string;
  fileSize: number;        // bytes
  format: FileFormat;

  status: DocumentStatus;
  filePath: string;        // local storage path
  md5Hash: string;         // dedup
  retryCount: number;      // max 3
  failReason?: string;
  
  // Phase 2 Fields
  processedContent?: string;    // Markdown output
  processingMetadata?: Json;    // Processing stats
  sourceType: SourceType;       // MANUAL or DRIVE
  driveFileId?: string;         // Google Drive file ID
  driveConfigId?: string;       // FK → DriveConfig
  lastSyncedAt?: Date;
  
  // Phase 3: Data Management
  isActive: boolean;             // User visibility toggle (default: true)
  connectionState: 'STANDALONE' | 'LINKED';  // Drive connection status
  
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
  embedding: number[];     // 384d vector (sentence-transformers)
  charStart: number;       // position in source
  charEnd: number;
  page?: number;           // PDF page (optional)
  heading?: string;        // extracted heading (optional)
  createdAt: Date;
}
```

### DriveConfig (NEW)

```typescript
interface DriveConfig {
  id: string;
  folderId: string;        // Google Drive folder ID
  folderName: string;
  syncCron: string;        // Default: "0 */6 * * *"
  recursive: boolean;      // Default: true
  enabled: boolean;        // Default: true
  lastSyncedAt?: Date;
  pageToken?: string;      // Changes API token
  syncStatus: 'IDLE' | 'SYNCING' | 'ERROR';
  syncError?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 2. Processing Flow Contracts

### Backend → BullMQ → Node.js Worker → Python AI Worker (HTTP)

> All files (PDF, JSON, TXT, MD) go through queue. AI Worker handles processing + embedding.

```typescript
// Job in BullMQ queue (picked by Node.js Worker)
interface ProcessingJob {
  documentId: string;
  filePath: string;
  format: FileFormat;      // Routing: PDF→Docling, others→TextProcessor
  config: ProcessingConfig;
}

interface ProcessingConfig {
  ocrMode: 'auto' | 'force' | 'never';
  ocrLanguages: string[];  // Default: ['en']
  chunkSize: number;       // Default: 1000
  chunkOverlap: number;    // Default: 200
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
  processedContent: string;    // Markdown output
  chunks: ChunkData[];         // Pre-chunked + embedded
  pageCount: number;
  ocrApplied: boolean;
  processingTimeMs: number;
}

interface ChunkData {
  content: string;
  index: number;
  embedding: number[];         // 384d vector (computed in Python)
  metadata: {
    charStart: number;
    charEnd: number;
    heading?: string;
    page?: number;             // PDF only
  };
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

}

// Errors
// 400: { error: 'INVALID_FORMAT', message: '...' }
// 400: { error: 'FILE_TOO_LARGE', message: '...' }
// 401: { error: 'UNAUTHORIZED' }
// 409: { error: 'DUPLICATE_FILE' }
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
  sourceType: SourceType;
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
  metadata: {
    charStart: number;
    charEnd: number;
    page?: number;
    heading?: string;
  };
}

// Note: Query automatically excludes documents with isActive=false
```

// GET /api/documents?status=COMPLETED&limit=20&offset=0&driveConfigId=xxx
// Phase 3 filters: isActive, connectionState, sourceType, search, sortBy, sortOrder

interface ListQueryParams {
  status?: DocumentStatus;
  driveConfigId?: string;
  limit?: number;           // Default: 20, Max: 100
  offset?: number;
  
  // Phase 3 additions
  isActive?: boolean;
  connectionState?: 'STANDALONE' | 'LINKED';
  sourceType?: 'MANUAL' | 'DRIVE';
  search?: string;          // Filename search (case-insensitive)
  sortBy?: 'createdAt' | 'filename' | 'fileSize';
  sortOrder?: 'asc' | 'desc';
}

interface ListResponse {
  documents: DocumentSummary[];
  total: number;
  counts: {
    active: number;
    inactive: number;
    failed: number;
    pending: number;
    processing: number;
    completed: number;
  };
}

interface DocumentSummary {
  id: string;
  filename: string;
  status: DocumentStatus;
  sourceType: SourceType;
  chunkCount?: number;
  fileSize: number;
  isActive: boolean;
  connectionState: 'STANDALONE' | 'LINKED';
  createdAt: string;
}

### Content Export (NEW)

```typescript
// GET /api/documents/:id/content?format=markdown|json

// format=markdown → Content-Type: text/markdown
// format=json → Content-Type: application/json

interface ContentJsonResponse {
  id: string;
  filename: string;
  processedContent: string;
  chunks: {
    id: string;
    content: string;
    index: number;
    metadata: {
      charStart: number;
      charEnd: number;
      heading?: string;
    };
  }[];
  processingMetadata: {
    pageCount?: number;
    ocrApplied?: boolean;
    processingTimeMs: number;
  };
}

// Errors
// 400: Invalid format
// 404: Document not found
// 409: Document not yet processed (status != COMPLETED)
```

### SSE Events (NEW)

```typescript
// GET /api/events?apiKey=xxx
// Content-Type: text/event-stream

// Events:
// - document:created: New document uploaded
// - document:status: Processing completed/failed
// - sync:start: Drive sync started
// - sync:complete: Drive sync finished
// - sync:error: Drive sync failed

interface SSEEvent {
  type: string;
  payload: unknown;
  timestamp: string;       // ISO
}

// Phase 3 Events:
// - document:deleted: Document hard deleted
// - document:availability: Availability toggled
// - bulk:completed: Bulk operation finished

// Errors
// 401: Invalid API key
```

### Drive Sync (NEW)

```typescript
// POST /api/drive/configs
interface AddFolderRequest {
  folderId: string;
  folderName: string;
  syncCron?: string;       // Default: "0 */6 * * *"
  recursive?: boolean;     // Default: true
}

// GET /api/drive/configs
interface DriveConfigListResponse {
  configs: DriveConfig[];
}

// PATCH /api/drive/configs/:id
interface UpdateFolderRequest {
  folderName?: string;
  syncCron?: string;
  recursive?: boolean;
  enabled?: boolean;
}

// DELETE /api/drive/configs/:id
// Returns 204 No Content

// POST /api/drive/sync/:configId/trigger
// Returns 202 Accepted (sync started)
```

### Data Management (Phase 3)

```typescript
// PATCH /api/documents/:id/availability
interface ToggleAvailabilityRequest {
  isActive: boolean;
}

interface ToggleAvailabilityResponse {
  id: string;
  isActive: boolean;
  updatedAt: string;
}
// Errors: 400 (not COMPLETED), 404 (not found)

// DELETE /api/documents/:id
// Hard delete document + chunks + file
interface DeleteResponse {
  id: string;
  deleted: true;
}
// Errors: 404 (not found), 409 (PROCESSING)

// POST /api/documents/:id/retry
// Reset FAILED document to PENDING
interface RetryResponse {
  id: string;
  status: 'PENDING';
}
// Errors: 400 (not FAILED), 404 (not found)

// PATCH /api/documents/bulk/availability
interface BulkToggleRequest {
  ids: string[];      // Max 100
  isActive: boolean;
}

interface BulkToggleResponse {
  updated: number;
  failed: { id: string; reason: string }[];
}

// POST /api/documents/bulk/delete
interface BulkDeleteRequest {
  ids: string[];      // Max 100
}

interface BulkDeleteResponse {
  deleted: number;
  failed: { id: string; reason: string }[];
}
```

---

## 4. Embedding Contract

```typescript
type EmbeddingProvider = 'sentence-transformers';  // Python

interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;           // 'BAAI/bge-small-en-v1.5'
  dimensions: number;      // 384
}

// Embeddings computed in Python AI Worker
// Sent via callback with chunks
```

---

## 5. Chunking Contract

```typescript
interface ChunkingConfig {
  chunkSize: number;       // 1000 chars
  chunkOverlap: number;    // 200 chars
  format: 'markdown';      // markdown-aware splitting (LangChain)
}

// Chunking performed in Python AI Worker
// TextProcessor for MD/TXT/JSON, PDFProcessor for PDF
```

---

## 6. File Routing (Phase 2)

```typescript
// All files go through queue → AI Worker
// AI Worker routes internally:
// - PDF → Docling (with OCR support)
// - MD → TextProcessor (as-is)
// - TXT → TextProcessor (wrap with heading)
// - JSON → TextProcessor (pretty print in code block)

const REJECTION_RULES = {
  maxFileSizeMB: 50,       // Manual upload
  maxDriveFileSizeMB: 100, // Drive sync
  allowedFormats: ['pdf', 'json', 'txt', 'md'],
  minTextLength: 50,
  maxNoiseRatio: 0.8,
};
```

---

**Phase 3 Status:** ✅ COMPLETE (Dec 24, 2025)

