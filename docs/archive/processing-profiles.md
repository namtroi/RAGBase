# Processing Profile - Extension Document

> **Status**: Complete

## Overview

Processing Profile allows configurable parameters for document processing pipeline. Each document links to one profile at processing time.

---

## Key Rules

| Rule | Description |
|------|-------------|
| Default profile undeletable | Always exists, cannot be removed |
| **Immutable profiles** | No editing after creation. Duplicate to modify. |
| **Active profile for manual uploads** | Manual uploads use currently active profile |
| **Drive sync uses DriveConfig profile** | Each Drive folder has assigned profile (not global active) |
| **Profile snapshot at upload** | Document captures profileId at upload moment, never changes |
| **Archive instead of delete** | Hide unused profiles to reduce clutter |
| Cascade delete | Delete archived profile → delete all linked documents/chunks |
| Embedding locked | Display-only, fixed in code |
| **Full display UI** | All settings visible on each profile card |

---

## Profile Snapshot Behavior

When document is uploaded, it captures the **currently active profile ID**. This prevents race conditions:

```
Timeline:
1. Active profile = "Default"
2. Upload Doc1 → Doc1.profileId = "Default" (snapshot)
3. User activates "Dense" profile
4. Upload Doc2 → Doc2.profileId = "Dense" (snapshot)
5. Doc1 finishes processing with "Default" settings ✅
6. Doc2 finishes processing with "Dense" settings ✅
```

**Benefits:**
- User can change active profile anytime (no blocking)
- In-flight documents keep their original profile
- Each document always uses profile from its upload moment

**Backend logic:**
```typescript
// On upload - capture active profile
const activeProfile = await prisma.processingProfile.findFirst({
  where: { isActive: true }
});

const document = await prisma.document.create({
  data: {
    ...fileData,
    processingProfileId: activeProfile.id  // Snapshot here
  }
});
```

---

## Development Approach

**Model:** Test Driven Development (TDD)

**Database:** Can drop and recreate (dev phase, no production data)

---

## Complete Settings Audit

All hardcoded settings across processing pipeline:

### Stage 1: Conversion (Raw → Markdown)

| Module | Setting | Default | Configurable? |
|--------|---------|---------|---------------|
| CsvConverter | MAX_TABLE_ROWS | 35 | ✅ |
| CsvConverter | MAX_TABLE_COLS | 20 | ✅ |
| XlsxConverter | MAX_TABLE_ROWS | 35 | ✅ |
| XlsxConverter | MAX_TABLE_COLS | 20 | ✅ |
| Router | pdfConverter | "pymupdf" | ✅ (pymupdf/docling) |
| PdfConverter | AcceleratorDevice | CPU | ❌ Fixed |
| config.py | ocr_mode | "auto" | ✅ (docling only) |
| config.py | ocr_languages | "en" | ✅ (docling only) |
| HtmlConverter | REMOVE_TAGS | nav,footer... | ❌ Fixed (advanced) |
| EpubConverter | SKIP_ITEMS | toc,nav,cover... | ❌ Fixed (advanced) |

### Stage 2: Chunking (Markdown → Chunks)

| Module | Setting | Default | Configurable? |
|--------|---------|---------|---------------|
| DocumentChunker | chunk_size | 1500 | ✅ |
| DocumentChunker | chunk_overlap | 200 | ✅ |
| DocumentChunker | headers_to_split | H1-H3 | ✅ |
| PresentationChunker | min_chunk_size | 200 | ✅ |
| TabularChunker | rows_per_chunk | 20 | ✅ |

### Stage 3: Quality (Chunk Analysis)

| Module | Setting | Default | Configurable? |
|--------|---------|---------|---------------|
| QualityAnalyzer | MIN_CHARS | 500 | ✅ |
| QualityAnalyzer | MAX_CHARS | 2000 | ✅ |
| QualityAnalyzer | PENALTY_PER_FLAG | 0.15 | ✅ |
| AutoFixer | MAX_PASSES | 2 | ✅ |
| AutoFixer | MAX_CHUNK_SIZE | 2000 | ✅ (same as MAX_CHARS) |
| AutoFixer | MIN_CHUNK_SIZE | 500 | ✅ (same as MIN_CHARS) |
| Normalizer | max_iterations | 10 | ❌ Fixed (internal) |

### Stage 4: Embedding

| Module | Setting | Default | Configurable? |
|--------|---------|---------|---------------|
| Embedder | model | BAAI/bge-small-en-v1.5 | ❌ Display only |
| Embedder | dimension | 384 | ❌ Display only |
| Embedder | max_length | 512 | ❌ Display only |
| Embedder | normalize_embeddings | True | ❌ Fixed |

### Analytics (Read-only)

| Module | Setting | Default | Notes |
|--------|---------|---------|-------|
| metrics.py | OVERSIZED_CHUNK_THRESHOLD | 1500 | For reporting only |

---

## Phase 1: Database Schema

### ProcessingProfile Model

```prisma
model ProcessingProfile {
  id           String   @id @default(cuid())
  name         String   @unique
  description  String?
  isActive     Boolean  @default(false) @map("is_active")
  isDefault    Boolean  @default(false) @map("is_default")  // Default profile flag
  isArchived   Boolean  @default(false) @map("is_archived") // Hide from main list
  createdAt    DateTime @default(now()) @map("created_at")
  
  // === Stage 1: Conversion ===
  pdfConverter           String  @default("pymupdf") @map("pdf_converter") // "pymupdf" | "docling"
  pdfOcrMode             String  @default("auto") @map("pdf_ocr_mode")       // docling only
  pdfOcrLanguages        String  @default("en")   @map("pdf_ocr_languages")  // comma-separated
  conversionTableRows    Int     @default(35)   @map("conversion_table_rows")
  conversionTableCols    Int     @default(20)   @map("conversion_table_cols")
  maxFileSizeMb          Int     @default(50)   @map("max_file_size_mb")     // Upload limit
  
  // === Stage 2: Chunking ===
  documentChunkSize       Int @default(1500) @map("document_chunk_size")
  documentChunkOverlap    Int @default(200)  @map("document_chunk_overlap")
  documentHeaderLevels    Int @default(3)    @map("document_header_levels")   // 1=H1, 2=H1-H2, 3=H1-H3
  presentationMinChunk    Int @default(200)  @map("presentation_min_chunk")
  tabularRowsPerChunk     Int @default(20)   @map("tabular_rows_per_chunk")
  
  // === Stage 3: Quality ===
  qualityMinChars         Int     @default(500)  @map("quality_min_chars")
  qualityMaxChars         Int     @default(2000) @map("quality_max_chars")
  qualityPenaltyPerFlag   Float   @default(0.15) @map("quality_penalty_per_flag")
  autoFixEnabled          Boolean @default(true) @map("auto_fix_enabled")
  autoFixMaxPasses        Int     @default(2)    @map("auto_fix_max_passes")
  
  // === Stage 4: Embedding (display-only, not editable) ===
  embeddingModel          String  @default("BAAI/bge-small-en-v1.5") @map("embedding_model")
  embeddingDimension      Int     @default(384) @map("embedding_dimension")
  embeddingMaxTokens      Int     @default(512) @map("embedding_max_tokens")
  
  documents     Document[]
  driveConfigs  DriveConfig[]
  
  @@map("processing_profiles")
}
```

### Document Model Update

```prisma
model Document {
  // ... existing fields
  processingProfileId  String  @map("processing_profile_id")
  processingProfile    ProcessingProfile @relation(fields: [processingProfileId], references: [id], onDelete: Cascade)
  
  @@index([processingProfileId])
}
```

### DriveConfig Model Update (Critical Fix)

Each Drive folder has its own profile - prevents wrong profile for background sync:

```prisma
model DriveConfig {
  // ... existing fields
  processingProfileId  String  @map("processing_profile_id")
  processingProfile    ProcessingProfile @relation(fields: [processingProfileId], references: [id])
  
  @@index([processingProfileId])
}
```

### Profile Selection Logic

| Source | Profile Used |
|--------|--------------|
| Manual upload | Active profile (snapshot at upload) |
| Drive sync | DriveConfig's assigned profile |

> **Important:** DriveConfig has fixed profile. Global active profile is for **manual uploads only**.

### Seed Default Profile

```typescript
// prisma/seed.ts
await prisma.processingProfile.upsert({
  where: { name: 'Default' },
  create: {
    name: 'Default',
    description: 'System default profile',
    isActive: true,
    isDefault: true,  // Cannot be deleted
  },
  update: {}
});
```

---

## Phase 2: Backend API

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profiles` | List visible profiles (excludes archived) |
| GET | `/api/profiles?includeArchived=true` | List all profiles |
| GET | `/api/profiles/active` | Get active profile |
| POST | `/api/profiles` | Create new profile |
| POST | `/api/profiles/:id/duplicate` | Clone with smart naming |
| PUT | `/api/profiles/:id/activate` | Set as active |
| PUT | `/api/profiles/:id/archive` | Archive profile |
| PUT | `/api/profiles/:id/unarchive` | Restore archived profile |
| DELETE | `/api/profiles/:id` | Delete (archived only) |

> **Note:** No PUT endpoint for editing. Profiles are immutable.

### Smart Duplicate Naming

When duplicating, auto-generate versioned name:
- "Default" → "Default v2"
- "Default v2" → "Default v3"
- User can modify before saving

```typescript
function generateDuplicateName(originalName: string): string {
  const versionMatch = originalName.match(/^(.+) v(\d+)$/);
  if (versionMatch) {
    const base = versionMatch[1];
    const version = parseInt(versionMatch[2]) + 1;
    return `${base} v${version}`;
  }
  return `${originalName} v2`;
}
```

### Archive vs Delete

| Action | Condition | Result |
|--------|-----------|--------|
| Archive | Any profile (except default) | Hide from list, keep data |
| Delete | Archived profiles only | Cascade delete docs/chunks |
| Delete | Non-archived profile | Error: "Archive first" |

### Tests

```typescript
// apps/backend/tests/unit/profiles/profile-routes.test.ts

describe('ProcessingProfile API', () => {
  
  describe('GET /api/profiles', () => {
    it('returns all profiles with document count');
    it('includes all settings in response');
  });
  
  describe('POST /api/profiles', () => {
    it('creates profile with custom values');
    it('enforces unique name');
    it('sets isDefault to false');
  });
  
  describe('POST /api/profiles/:id/duplicate', () => {
    it('creates copy with new name');
    it('copies all settings');
  });
  
  describe('PUT /api/profiles/:id/activate', () => {
    it('sets profile active, deactivates others');
  });
  
  describe('DELETE /api/profiles/:id', () => {
    it('blocks deleting default profile');
    it('blocks deleting active profile');
    it('returns confirmation with document/chunk count');
    it('cascade deletes on confirm');
  });
});
```

### Delete Logic

```typescript
router.delete('/:id', async (req, res) => {
  const { confirmed } = req.body;
  
  const profile = await prisma.processingProfile.findUnique({
    where: { id: req.params.id },
    include: {
      _count: { select: { documents: true } },
      documents: { include: { _count: { select: { chunks: true } } } }
    }
  });
  
  // Block default profile deletion
  if (profile.isDefault) {
    return res.status(400).json({ error: 'Cannot delete default profile' });
  }
  
  // Block active profile deletion  
  if (profile.isActive) {
    return res.status(400).json({ error: 'Cannot delete active profile. Activate another first.' });
  }
  
  const totalChunks = profile.documents.reduce((sum, d) => sum + d._count.chunks, 0);
  
  // Require confirmation if has documents
  if (!confirmed && profile._count.documents > 0) {
    return res.json({
      requireConfirmation: true,
      documentCount: profile._count.documents,
      chunkCount: totalChunks,
      message: `Delete ${profile._count.documents} documents and ${totalChunks} chunks?`
    });
  }
  
  await prisma.processingProfile.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});
```

---

## Phase 3: AI Worker

### ProfileConfig Model

```python
# apps/ai-worker/src/models.py

class ProfileConfig(BaseModel):
    """Processing profile configuration from job payload."""
    
    # Stage 1: Conversion
    pdfConverter: str = "pymupdf"  # "pymupdf" (fast) | "docling" (high quality)
    pdfOcrMode: str = "auto"       # docling only
    pdfOcrLanguages: str = "en"    # Comma-separated: "en,vi"
    conversionTableRows: int = 35
    conversionTableCols: int = 20
    
    # Stage 2: Chunking
    documentChunkSize: int = 1500
    documentChunkOverlap: int = 200
    documentHeaderLevels: int = 3
    presentationMinChunk: int = 200
    tabularRowsPerChunk: int = 20
    
    # Stage 3: Quality
    qualityMinChars: int = 500
    qualityMaxChars: int = 2000
    qualityPenaltyPerFlag: float = 0.15
    autoFixEnabled: bool = True
    autoFixMaxPasses: int = 2
    
    @property
    def ocr_languages_list(self) -> list[str]:
        """Parse comma-separated languages to list for EasyOCR/Tesseract."""
        return [lang.strip() for lang in self.pdfOcrLanguages.split(",") if lang.strip()]
```

> **Note:** Use `config.ocr_languages_list` when passing to OCR libraries, not the raw string.

### Refactor Modules

| Module | Change |
|--------|--------|
| CsvConverter | Accept `config.conversion_table_rows/cols` |
| XlsxConverter | Accept `config.conversion_table_rows/cols` |
| PdfConverter | Accept `config.pdf_*` settings |
| DocumentChunker | Accept `config.document_chunk_*` |
| PresentationChunker | Accept `config.presentation_min_chunk` |
| TabularChunker | Accept `config.tabular_rows_per_chunk` |
| QualityAnalyzer | Accept `config.quality_*` |
| AutoFixer | Accept `config.auto_fix_*` |

### Tests

```python
# apps/ai-worker/tests/test_profile_config.py

def test_profile_defaults():
    config = ProfileConfig()
    assert config.documentChunkSize == 1500
    assert config.pdfOcrLanguages == "en"

def test_chunker_uses_config():
    config = ProfileConfig(documentChunkSize=500)
    chunker = DocumentChunker(config)
    # verify chunk_size is 500
```

---

## Phase 4: Frontend

### Navigation Update

```typescript
// App.tsx tabs array
const tabs = [
  { id: 'drive', label: 'Drive Sync', icon: FolderSync },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'chunks', label: 'Chunks', icon: Layers },
  { id: 'query', label: 'Search', icon: Search },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'profiles', label: 'Processing Profile', icon: Sliders },  // NEW
];
```

### Components

```
components/profiles/
├── ProfilePage.tsx           # Main tab
├── ProfileCard.tsx           # Full display card with all settings
├── ProfileCreateDialog.tsx   # Create new profile form
├── ProfileDeleteDialog.tsx   # Delete confirmation
└── hooks/
    ├── useProfiles.ts
    └── useActiveProfile.ts
```

> **Note:** No ProfileEditDialog - profiles are immutable.

### ProfileCard - Full Display Layout

Each profile card shows ALL settings:

```
┌─────────────────────────────────────────────────────────────────┐
│  Default                                    [Active] [🗑️ Delete] │
│  System default profile                                         │
│                                                                 │
│  ┌─ Conversion ─────────────────────────────────────────────┐   │
│  │ Table Rows: 35    Table Cols: 20    OCR: auto            │   │
│  │ OCR Languages: en  Threads: 4    Table Structure: Off    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─ Chunking ───────────────────────────────────────────────┐   │
│  │ Chunk Size: 1000    Overlap: 100    Headers: H1-H3       │   │
│  │ Presentation Min: 200    Tabular Rows: 20                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─ Quality ────────────────────────────────────────────────┐   │
│  │ Min Chars: 50    Max Chars: 2000    Penalty: 0.15        │   │
│  │ Auto-Fix: On    Max Passes: 2                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─ Embedding (locked) ─────────────────────────────────────┐   │
│  │ 🔒 Model: BAAI/bge-small-en-v1.5                          │   │
│  │ 🔒 Dimension: 384    Max Tokens: 512                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  📄 12 documents                                                │
└─────────────────────────────────────────────────────────────────┘
```

### ProfileCreateDialog

Form with all settings (grouped by section):

```
┌─────────────────────────────────────────────────────────────────┐
│  Create New Profile                                       [X]   │
│                                                                 │
│  Name: _______________    Description: _______________          │
│                                                                 │
│  ▼ Conversion                                                   │
│    Table Rows: [35]    Table Cols: [20]                         │
│    OCR Mode: [auto ▼]  OCR Languages: [en]                      │
│    Threads: [4]  Table Structure: [  ]                          │
│                                                                 │
│  ▼ Chunking                                                     │
│    Chunk Size: [1000]  Overlap: [100]  Header Levels: [3]       │
│    Presentation Min: [200]  Tabular Rows: [20]                  │
│                                                                 │
│  ▼ Quality                                                      │
│    Min Chars: [50]  Max Chars: [2000]  Penalty: [0.15]          │
│    Auto-Fix: [✓]  Max Passes: [2]                               │
│                                                                 │
│  ▼ Embedding (display only)                                     │
│    🔒 Model: BAAI/bge-small-en-v1.5                              │
│    🔒 Dimension: 384    Max Tokens: 512                          │
│                                                                 │
│                              [Cancel]  [Create Profile]         │
└─────────────────────────────────────────────────────────────────┘
```

### Delete Dialog

```
┌─────────────────────────────────────────────────────────────────┐
│  Delete Profile "Dense Chunking"?                               │
│                                                                 │
│  ⚠️ This will permanently delete:                               │
│     • 15 documents                                              │
│     • 342 chunks                                                │
│                                                                 │
│  Type "Dense Chunking" to confirm:                              │
│  ┌─────────────────────────────────────────┐                    │
│  │                                         │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                 │
│                     [Cancel]  [Delete Forever]                  │
└─────────────────────────────────────────────────────────────────┘
```

### DocumentList Update

- Show profile name badge on each document card (read-only)

---

## Implementation Order

1. **Database:** schema + migration + seed
2. **API:** routes + tests
3. **Worker:** ProfileConfig + module refactor
4. **Frontend:** tab + components + hooks

---

## Commands

```bash
# Drop and recreate database
pnpm prisma migrate reset --force

# Run migration
pnpm prisma migrate dev --name add_processing_profiles

# Seed default profile
pnpm prisma db seed

# Run tests
pnpm test -- --grep "profile"
pytest tests/ -k "profile"
```

---

## Recent Changes Summary

### Settings Moved to Profile

| Setting | Was | Now |
|---------|-----|-----|
| `maxFileSizeMb` | `MAX_FILE_SIZE_MB` env | Profile field |
| `pdfOcrMode` | `OCR_MODE` + `OCR_ENABLED` env | Profile field only |

### Removed Settings

| Setting | Reason |
|---------|--------|
| `OCR_ENABLED` | Redundant. `pdfOcrMode` controls OCR fully. |
| `MAX_WORKERS` (AI worker) | Removed. BullMQ's `PDF_CONCURRENCY` controls all concurrency. |
| `processingConcurrency` | Removed from profile. Use `PDF_CONCURRENCY` env var. |

### Infrastructure Settings (Env Vars Only)

| Env Var | Default | Purpose |
|---------|---------|---------||
| `PDF_CONCURRENCY` | 1 | Controls BullMQ + AI worker concurrency. Single setting. |

### OCR Control Simplified

**Before:**
```
if ocr_mode == "force" or (ocr_mode == "auto" and settings.ocr_enabled):
    do_ocr = True
```

**After:**
```
if ocr_mode == "force" or ocr_mode == "auto":
    do_ocr = True
elif ocr_mode == "never":
    do_ocr = False
```

`pdfOcrMode` alone controls OCR. No env var dependency.
