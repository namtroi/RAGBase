# RAGBase API Contracts

**Phase 5 Complete** | **TDD Reference & Integration Spec**

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
  driveFolderId?: string;       // FK → DriveFolder
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
  embedding: number[];     // DEPRECATED: Use denseVector (Phase 5)
  
  // Phase 4: Quality & Location
  location?: Json;         // {"page": 1} or {"slide": 3} or {"sheet": "Sales"}
  breadcrumbs: string[];   // ["Chapter 1", "Section 2", "Intro"]
  qualityScore?: number;   // 0-1, higher is better
  qualityFlags: string[];  // ["TOO_SHORT", "NO_CONTEXT", ...]
  chunkType?: string;      // "document" | "presentation" | "tabular"
  tokenCount?: number;     // Embedding token count
  completeness?: string;   // "complete" | "partial"
  hasTitle?: boolean;      // Has heading/title
  
  // Phase 5: Qdrant Sync (Hybrid Vectors)
  syncStatus: 'PENDING' | 'SYNCED' | 'FAILED';
  denseVector?: number[];         // 384d (nullable after sync)
  sparseIndices?: number[];       // SPLADE indices (nullable after sync)
  sparseValues?: number[];        // SPLADE values (nullable after sync)
  qdrantId?: string;              // Qdrant point ID
  
  createdAt: Date;
}
```

### DriveConfig (Phase 5 - Per-User OAuth)

```typescript
interface DriveConfig {
  id: string;
  userId: string;                // User identifier ("system" for demo)
  
  // OAuth 2.0 Credentials (AES-256-GCM encrypted)
  encryptedRefreshToken?: string; // Encrypted refresh token
  tokenIv?: string;               // Initialization vector
  tokenAuthTag?: string;          // Auth tag for GCM
  
  userEmail?: string;            // Connected Google account
  isConnected: boolean;          // OAuth status
  lastSyncedAt?: Date;
  pageToken?: string;            // Changes API token
  
  createdAt: Date;
  updatedAt: Date;
}
```

### DriveFolderMapping

```typescript
interface DriveFolderMapping {
  id: string;
  driveConfigId: string;        // FK → DriveConfig
  folderId: string;             // Google Drive folder ID
  folderName: string;
  syncCron: string;             // Default: "0 */6 * * *"
  recursive: boolean;           // Default: true
  enabled: boolean;             // Default: true
  syncStatus: 'IDLE' | 'SYNCING' | 'ERROR';
  syncError?: string;
  processingProfileId?: string; // FK → ProcessingProfile
  createdAt: Date;
  updatedAt: Date;
}
```

### ProcessingProfile

```typescript
interface ProcessingProfile {
  id: string;
  name: string;            // Unique
  description?: string;
  isActive: boolean;       // Active for manual uploads
  isDefault: boolean;      // System default (undeletable)
  isArchived: boolean;     // Hidden from main list
  
  // Stage 1: Conversion
  pdfConverter: 'pymupdf' | 'docling';  // Default: 'pymupdf'
  pdfOcrMode: 'auto' | 'force' | 'never';  // Docling only
  pdfOcrLanguages: string;    // Comma-separated: "en,vi"
  conversionTableRows: number;  // Default: 35
  conversionTableCols: number;  // Default: 20
  maxFileSizeMb: number;        // Default: 50
  
  // Stage 2: Chunking
  documentChunkSize: number;     // Default: 1500
  documentChunkOverlap: number;  // Default: 200
  documentHeaderLevels: number;  // 1=H1, 2=H1-H2, 3=H1-H3
  presentationMinChunk: number;  // Default: 200
  tabularRowsPerChunk: number;   // Default: 20
  
  // Stage 3: Quality
  qualityMinChars: number;       // Default: 500
  qualityMaxChars: number;       // Default: 2000
  qualityPenaltyPerFlag: number; // Default: 0.15
  autoFixEnabled: boolean;       // Default: true
  autoFixMaxPasses: number;      // Default: 2
  
  // Stage 4: Embedding (display-only, Phase 5 - Hybrid)
  embeddingModel: string;        // Fixed: 'BAAI/bge-small-en-v1.5'
  embeddingDimension: number;    // Fixed: 384 (dense)
  embeddingMaxTokens: number;    // Fixed: 512
  sparseModel: string;           // Fixed: 'SPLADE' (neural sparse)
  
  createdAt: Date;
}
```

### ProcessingMetrics (Analytics)

```typescript
interface ProcessingMetrics {
  id: string;
  documentId: string;       // FK → Document (1:1)
  
  // Migrated from processingMetadata
  pageCount: number;
  ocrApplied: boolean;
  
  // Queue timing
  enqueuedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  queueTimeMs: number;      // startedAt - enqueuedAt
  
  // Processing time breakdown
  conversionTimeMs: number;
  chunkingTimeMs: number;
  embeddingTimeMs: number;
  totalTimeMs: number;      // Sum of above
  userWaitTimeMs: number;   // queueTimeMs + totalTimeMs
  
  // Size metrics
  rawSizeBytes: number;
  markdownSizeChars: number;
  
  // Chunking efficiency
  totalChunks: number;
  avgChunkSize: number;
  oversizedChunks: number;
  
  // Quality summary (aggregated)
  avgQualityScore: number;
  qualityFlags: Json;       // {"TOO_SHORT": 2, "NO_CONTEXT": 1}
  totalTokens: number;
  
  createdAt: Date;
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
  embedding: number[];         // DEPRECATED: dense vector (384d)
  denseVector: number[];       // Phase 5: 384d dense vector
  sparseIndices?: number[];    // Phase 5: SPLADE sparse indices
  sparseValues?: number[];     // Phase 5: SPLADE sparse values
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

### Query (Hybrid Search)

```typescript
// POST /api/query
interface QueryRequest {
  query: string;           // 1-1000 chars
  topK?: number;           // 1-100, default 5
  mode?: 'semantic' | 'hybrid';  // Default: 'semantic'
  alpha?: number;          // 0.0-1.0, default 0.7 (70% vector, 30% keyword)
}

interface QueryResponse {
  results: QueryResult[];
}

interface QueryResult {
  content: string;
  score: number;           // Combined score (RRF for hybrid)
  vectorScore?: number;    // Hybrid mode: dense vector component
  keywordScore?: number;   // Hybrid mode: SPLADE sparse component
  documentId: string;
  metadata: {
    page?: number;
    heading?: string;
    breadcrumbs?: string[];
    qualityScore?: number;
  };
}

// Note: Query automatically excludes documents with isActive=false
// Hybrid mode uses Qdrant RRF (Reciprocal Rank Fusion) for score combination
// Phase 5: Uses SPLADE neural sparse vectors (not BM25)
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
// GET /api/events
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
```

### Drive Sync (Phase 5 - OAuth)

```typescript
// GET /api/oauth/google/url
// Initiate OAuth 2.0 flow
interface OAuthUrlResponse {
  authUrl: string;         // Google OAuth consent URL
}

// GET /api/oauth/google/callback?code=xxx
// OAuth callback (exchange code for tokens)
// Redirects to frontend with success/error

// GET /api/oauth/google/status
interface OAuthStatusResponse {
  isConnected: boolean;
  userEmail?: string;
  connectedAt?: string;    // ISO
}

// POST /api/oauth/google/disconnect
// Revoke OAuth connection
// Returns 200 OK

// GET /api/oauth/google/access-token
// Get short-lived access token for Google Picker API (frontend)
interface AccessTokenResponse {
  accessToken: string;     // 1-hour token
}

// POST /api/drive/folders
interface AddFolderRequest {
  folderId: string;
  folderName?: string;     // Optional, fetched from Drive if missing
  syncCron?: string;       // Default: "0 */6 * * *"
  recursive?: boolean;     // Default: true
}

// GET /api/drive/folders
interface DriveFolderListResponse {
  folders: DriveFolderMapping[];
}

// PATCH /api/drive/folders/:id
interface UpdateFolderRequest {
  folderName?: string;
  syncCron?: string;
  recursive?: boolean;
  enabled?: boolean;
}

// DELETE /api/drive/folders/:id
// Returns 204 No Content

// POST /api/drive/folders/:id/sync
// Trigger manual sync for folder
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

### Analytics API

```typescript
// GET /api/analytics/overview?period=7d
interface AnalyticsOverviewResponse {
  totalDocuments: number;
  avgProcessingTimeMs: number;
  avgQualityScore: number;
  totalChunks: number;
  periodStart: string;     // ISO
  periodEnd: string;
}

// GET /api/analytics/processing?period=7d
interface ProcessingAnalyticsResponse {
  timeBreakdown: {
    conversion: number;
    chunking: number;
    embedding: number;
    queue: number;
  };
  trends: { date: string; count: number; avgTime: number }[];
}

// GET /api/analytics/quality?period=7d
interface QualityAnalyticsResponse {
  distribution: { excellent: number; good: number; low: number };
  flagCounts: Record<string, number>;  // {"TOO_SHORT": 45, ...}
}

// GET /api/analytics/documents?page=1&limit=20
// Paginated per-document metrics
```

### Chunks Explorer API

```typescript
// GET /api/chunks?documentId=xxx&quality=excellent&type=document&flags=TOO_SHORT&search=keyword&page=1&limit=20
interface ChunksListResponse {
  chunks: ChunkSummary[];
  total: number;
  page: number;
  totalPages: number;
}

interface ChunkSummary {
  id: string;
  documentId: string;
  documentFilename: string;
  content: string;         // Truncated preview
  chunkIndex: number;
  qualityScore: number;
  qualityFlags: string[];
  chunkType: string;
  tokenCount: number;
  breadcrumbs: string[];
}

// GET /api/chunks/:id
interface ChunkDetailResponse {
  id: string;
  content: string;         // Full content
  // ... all Chunk fields
}

// Quality filter values:
// - excellent: >= 0.85
// - good: 0.70 - 0.84
// - low: < 0.70
```

### Processing Profiles API

```typescript
// GET /api/profiles
// GET /api/profiles?includeArchived=true
interface ProfilesListResponse {
  profiles: ProcessingProfile[];
}

// GET /api/profiles/active
interface ActiveProfileResponse {
  profile: ProcessingProfile;
}

// POST /api/profiles
interface CreateProfileRequest {
  name: string;
  description?: string;
  // All optional settings with defaults
  pdfConverter?: 'pymupdf' | 'docling';
  documentChunkSize?: number;
  // ... other settings
}

// POST /api/profiles/:id/duplicate
interface DuplicateProfileRequest {
  name?: string;           // Auto-generated if not provided
}

// PUT /api/profiles/:id/activate
// Sets profile as active, deactivates others
// Returns 200 with updated profile

// PUT /api/profiles/:id/archive
// PUT /api/profiles/:id/unarchive
// Returns 200 with updated profile

// DELETE /api/profiles/:id
interface DeleteProfileRequest {
  confirmed?: boolean;     // Required if profile has documents
}

interface DeleteConfirmationResponse {
  requireConfirmation: true;
  documentCount: number;
  chunkCount: number;
  message: string;
}

// Errors:
// 400: Cannot delete default profile
// 400: Cannot delete active profile
// 400: Must archive before delete
```

---

## 4. Embedding Contract (Phase 5 - Hybrid)

```typescript
type EmbeddingProvider = 'fastembed';  // Python FastEmbed library

interface EmbeddingConfig {
  provider: EmbeddingProvider;
  denseModel: string;      // 'BAAI/bge-small-en-v1.5'
  sparseModel: string;     // 'SPLADE' (neural sparse)
  denseDimensions: number; // 384
}

interface HybridEmbedding {
  dense: number[];         // 384d dense vector
  sparse: {
    indices: number[];     // Sparse vector indices
    values: number[];      // Sparse vector values
  };
}

// Embeddings computed in Python AI Worker
// Sent via callback with chunks as denseVector + sparseIndices + sparseValues
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
  pdf: 'PyMuPDFConverter',  // Fast default (or DoclingConverter via profile)
  docx: 'DocxConverter',    // Docling
  pptx: 'PptxConverter',    // Docling + slide markers
  html: 'HtmlConverter',    // BeautifulSoup + Markdownify
  epub: 'EpubConverter',    // EbookLib
  xlsx: 'XlsxConverter',    // OpenPyXL
  csv: 'CsvConverter',      // Pandas
  txt: 'TxtConverter',      // Passthrough
  md: 'MdConverter',        // Passthrough
  json: 'JsonConverter',    // Pretty print
};

const CATEGORY_MAP = {
  pdf: 'document', docx: 'document', txt: 'document',
  md: 'document', html: 'document', epub: 'document',
  json: 'document',         // Treat JSON as document
  pptx: 'presentation',
  xlsx: 'tabular', csv: 'tabular',
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
  | 'TOO_SHORT'     // < qualityMinChars (default: 500)
  | 'TOO_LONG'      // > qualityMaxChars (default: 2000)
  | 'NO_CONTEXT'    // No heading, no breadcrumbs
  | 'FRAGMENT'      // Mid-sentence cut
  | 'EMPTY';        // Whitespace only

// Score calculation:
// Base: 1.0
// Penalty: qualityPenaltyPerFlag (default: -0.15) per flag
// Range: 0.0 - 1.0
// Thresholds configurable via ProcessingProfile
```

---

**Phase 5 Status:** ✅ COMPLETE (Jan 1, 2026)

- Phase 4: Format Converters, Chunking, Quality ✅
- Analytics Dashboard ✅
- Hybrid Search (Qdrant + SPLADE) ✅  
- Processing Profiles ✅
- Per-User OAuth 2.0 + AES-256-GCM Encryption ✅
- Qdrant Outbox Pattern (90%+ storage savings) ✅
- Dense + Sparse Vectors (fastembed) ✅
