# RAGBase API Contracts

**Phase 4 Complete** | **TDD Reference & Integration Spec**

---

## 1. Core Entities

### Document

```typescript
type DocumentStatus = 
  | 'PENDING'     // Uploaded, waiting queue
  | 'PROCESSING'  // In worker
  | 'COMPLETED'   // Success
  | 'FAILED';     // Gave up after retries

type FileFormat = 'pdf' | 'docx' | 'pptx' | 'html' | 'epub' | 'xlsx' | 'csv' | 'json' | 'txt' | 'md';
type FormatCategory = 'document' | 'presentation' | 'tabular';
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
  
  // Phase 4: Format Metadata
  formatCategory?: FormatCategory;  // document, presentation, tabular
  
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
  
  // Phase 4: Quality & Location
  location?: Json;         // {"page": 1} or {"slide": 3} or {"sheet": "Sales"}
  breadcrumbs: string[];   // ["Chapter 1", "Section 2", "Intro"]
  qualityScore?: number;   // 0-1, higher is better
  qualityFlags: string[];  // ["TOO_SHORT", "NO_CONTEXT", ...]
  chunkType?: string;      // "document" | "presentation" | "tabular"
  tokenCount?: number;     // Embedding token count
  completeness?: string;   // "complete" | "partial"
  hasTitle?: boolean;      // Has heading/title
  
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

> All files (10 formats) go through queue. AI Worker handles conversion + chunking + quality + embedding.

```typescript
// Job in BullMQ queue (picked by Node.js Worker)
interface ProcessingJob {
  documentId: string;
  filePath: string;
  format: FileFormat;      // Routes to appropriate converter
  config: ProcessingConfig;
}

interface ProcessingConfig {
  ocrMode: 'auto' | 'force' | 'never';  // PDF/DOCX only
  ocrLanguages: string[];  // Default: ['en']
  chunkSize: number;       // Default: 1000
  chunkOverlap: number;    // Default: 200
}
```

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
  chunks: ChunkData[];         // Pre-chunked + embedded + quality scored
  pageCount?: number;
  slideCount?: number;         // PPTX
  sheetCount?: number;         // XLSX
  chapterCount?: number;       // EPUB
  ocrApplied: boolean;
  processingTimeMs: number;
  formatCategory: FormatCategory;  // document, presentation, tabular
}

interface ChunkData {
  content: string;
  index: number;
  embedding: number[];         // 384d vector (computed in Python)
  metadata: {
    charStart: number;
    charEnd: number;
    heading?: string;
    page?: number;             // PDF/DOCX
    slide?: number;            // PPTX
    sheet?: string;            // XLSX
    // Phase 4: Quality metadata
    location?: Json;
    breadcrumbs?: string[];
    qualityScore?: number;
    qualityFlags?: string[];
    chunkType?: string;
    tokenCount?: number;
    completeness?: string;
    hasTitle?: boolean;
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
  | 'EMPTY_CONTENT'            // No extractable text
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

// Chunking by category in Python AI Worker:
// - Document (PDF, DOCX, TXT, MD, HTML, EPUB): Header-based with breadcrumbs
// - Presentation (PPTX): Slide-based with grouping
// - Tabular (XLSX, CSV, JSON): Row-based or table format
```

---

## 6. File Routing (Phase 4)

```typescript
// All files go through queue → AI Worker
// Router selects converter by format:

const CONVERTER_MAP = {
  pdf: 'PdfConverter',      // Docling + OCR
  docx: 'PdfConverter',     // Docling
  pptx: 'PptxConverter',    // Docling + slide markers
  html: 'HtmlConverter',    // BeautifulSoup + Markdownify
  epub: 'EpubConverter',    // EbookLib
  xlsx: 'XlsxConverter',    // OpenPyXL
  csv: 'CsvConverter',      // Pandas
  txt: 'TextConverter',     // Passthrough
  md: 'TextConverter',      // Passthrough
  json: 'TextConverter',    // Pretty print
};

const CATEGORY_MAP = {
  pdf: 'document', docx: 'document', txt: 'document',
  md: 'document', html: 'document', epub: 'document',
  pptx: 'presentation',
  xlsx: 'tabular', csv: 'tabular', json: 'tabular',
};

const REJECTION_RULES = {
  maxFileSizeMB: 50,       // Manual upload
  maxDriveFileSizeMB: 100, // Drive sync
  allowedFormats: ['pdf', 'docx', 'pptx', 'html', 'epub', 'xlsx', 'csv', 'json', 'txt', 'md'],
  minTextLength: 50,
  maxNoiseRatio: 0.8,
};
```

---

## 7. Quality Flags (Phase 4)

```typescript
type QualityFlag =
  | 'TOO_SHORT'     // < 50 chars
  | 'TOO_LONG'      // > 2000 chars
  | 'NO_CONTEXT'    // No heading, no breadcrumbs
  | 'FRAGMENT'      // Mid-sentence cut
  | 'EMPTY';        // Whitespace only

// Score calculation:
// Base: 1.0
// Penalty: -0.15 per flag
// Range: 0.0 - 1.0
```

---

**Phase 4 Status:** ✅ COMPLETE (Dec 27, 2025)

