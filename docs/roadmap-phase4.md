# Phase 4: Format Expansion + Chunking Optimization

**Goal:** Support 6 new document formats with format-aware chunking strategies for optimal RAG quality.

---

## Core Concept: Markdown-First Pipeline

**All formats convert to markdown BEFORE chunking.**

```
┌────────────────────────────────────────────────────────────────┐
│                    PROCESSING PIPELINE                         │
├────────────────────────────────────────────────────────────────┤
│  1. INGEST        → Raw file upload                            │
│  2. DETECT        → Format detection                           │
│  3. EXTRACT       → Format processor → Raw markdown            │
│  4. NORMALIZE     → Markdown normalizer → Clean markdown  [NEW]│
│  5. CATEGORIZE    → Assign format category                [NEW]│
│  6. CHUNK         → Category-specific chunking strategy        │
│  7. ANALYZE       → Quality metrics + flags               [NEW]│
│  8. FIX           → Auto-fix (merge/split/context)        [NEW]│
│  9. EMBED         → Vector embedding                           │
│  10. STORE        → Database (chunks + quality metadata)       │
└────────────────────────────────────────────────────────────────┘
```

**Benefits:**
- Unified chunking logic (only tune markdown splitter)
- Consistent output quality across formats
- Single debug point (inspect markdown intermediate)
- Decouple format processing from chunking logic

---

## New Formats

| Format | Processor | Output |
|--------|-----------|--------|
| `.docx` | Docling | Markdown |
| `.xlsx` | openpyxl | Markdown tables |
| `.csv` | pandas | Markdown tables |
| `.pptx` | Docling | Markdown (slide-separated) |
| `.html` | BeautifulSoup | Markdown |
| `.epub` | ebooklib | Markdown (chapter-separated) |

---

## Format Categories

**3 categories with dedicated chunking strategies:**

| Category | Formats | Chunking Strategy | Rationale |
|----------|---------|-------------------|-----------|
| **Document** | PDF, DOCX, TXT, MD, HTML, EPUB | Header-based | Text with heading hierarchy |
| **Presentation** | PPTX | Slide-based | Slides are semantic units |
| **Tabular** | XLSX, CSV, JSON (arrays) | Row-based | Headers provide context |

---

## Input Sanitization (Critical)

**Runs IMMEDIATELY after EXTRACT step, before Markdown Normalizer.**

**Problem:** Files from external sources contain "invisible garbage" that crashes embedding models.

| Issue | Example | Fix |
|-------|---------|-----|
| Null bytes | `\x00` | Remove |
| Control characters | `\x01-\x1f` | Strip (except `\n`, `\t`) |
| Encoding errors | Mojibake | Fix with ftfy |
| Unicode issues | Mixed encodings | Normalize to NFC |

**Implementation:**
```python
def sanitize(text: str) -> str:
    text = text.replace('\x00', '')
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    text = unicodedata.normalize('NFC', text)
    text = ftfy.fix_text(text)  # Optional
    return text
```

**Pipeline position:** `EXTRACT → SANITIZE → NORMALIZE → CHUNK`

---

## Pre-processing Layer: Markdown Normalizer

**Runs after sanitization, before chunking.**

Ensures consistent markdown input regardless of source format.

| Issue | Example | Fix |
|-------|---------|-----|
| Heading gaps | `#` → `###` (skip H2) | Normalize hierarchy |
| Empty sections | `## Title\n\n## Next` | Remove empty section |
| Excess whitespace | `text   \n\n\n\n` | Trim to single newline |
| Inconsistent bullets | `* item`, `+ item` | Standardize to `- item` |
| Malformed tables | Broken markdown tables | Fix or convert to text |

---

## Chunking Strategies by Category

### 1. Document Category (PDF, DOCX, TXT, MD, HTML, EPUB)

**Strategy:** Header-based splitting with production enhancements

**Pipeline:**
1. Format processor → markdown (preserve heading hierarchy)
2. Normalize markdown
3. Split by headings (H1 → H2 → H3)
4. Apply recursive fallback for oversized chunks
5. Enforce sentence boundaries
6. Inject contextual headers

---

#### Enhancement 1: Recursive Fallback

**Problem:** Documents without headings create giant single chunks.

**Solution:** Chain splitters with fallback:
```
1. Try: MarkdownHeaderTextSplitter
2. If chunk > max_size: RecursiveCharacterTextSplitter
```

**RecursiveCharacterTextSplitter separators (in order):**
1. `\n\n` (paragraphs)
2. `\n` (lines)
3. `. ` (sentences)
4. ` ` (words - last resort)

---

#### Enhancement 2: Sentence Boundary Awareness

**Problem:** Character-based splitting cuts mid-sentence, hurting retrieval quality.

**Solution:** Snap split points to nearest sentence boundary.

**Logic:**
```
target_size = 1000 chars
search_window = target_size ± 100 chars
split_at = nearest sentence end (., !, ?) within window
```

**Impact:** +5-10% retrieval accuracy (per benchmarks)

---

#### Enhancement 3: Contextual Headers (Breadcrumbs)

**Problem:** Nested sections lose parent context after chunking.

**Example before:**
```markdown
# Chapter 1: Introduction
## 1.1 Overview
### 1.1.1 Background
Content here...  ← Chunk only has "Content here"
```

**Solution:** Inject heading breadcrumb into each chunk:
```markdown
# Chapter 1: Introduction > 1.1 Overview > 1.1.1 Background

Content here...
```

**Benefits:**
- Full context preserved in every chunk
- Better semantic search (headings add keywords)
- Improved citation accuracy

---

#### Enhancement 4: Token-based Limits

**Problem:** Char-based limits don't align with model tokenization.

**Current:** 1000 chars (inconsistent token count)

**Better:** Token-based limits for embedding model alignment:
```
BGE-small max: 512 tokens
Target chunk: ~400 tokens (safety margin)
1 token ≈ 4 chars (English) / 2 chars (Vietnamese)
```

**Params:**
- `CHUNK_MAX_TOKENS`: 400
- `CHUNK_OVERLAP_TOKENS`: 50

**Fallback:** If tokenizer unavailable, use char-based (1000 chars)

---

**EPUB special handling:** Split by chapter markers first, then headers within chapters.

**HTML special handling:** Respect semantic HTML (`<section>`, `<article>`) before header splitting.

---

### 2. Presentation Category (PPTX)

**Strategy:** Slide-based chunking

**Logic:**
- Default: 1 slide = 1 chunk
- Group small slides (<200 chars) to avoid fragmentation
- Metadata: slide number, slide title

**Params:**
- `group_small_slides`: true
- `min_slide_chars`: 200

---

### 3. Tabular Category (XLSX, CSV)

**Hybrid Strategy:** Format based on table dimensions.

#### Decision Logic

| Condition | Strategy |
|-----------|----------|
| rows ≤ 35 **AND** cols ≤ 20 | Markdown table |
| Otherwise | Sentence serialization |

---

#### Small Tables: Markdown Table
- Render as standard markdown table
- Single chunk containing full table
- Preserves visual structure

---

#### Large/Wide Tables: Sentence Serialization

**Problem:** Markdown tables lose headers when chunked, waste tokens on `|` delimiters.

**Solution:** Convert each row to semantic sentence string.

**Format:**
```
Sheet: {SheetName}. {Header_A} is {Value_A}. {Header_B} is {Value_B}.
```

**Example:**
```
# Raw data (100 rows × 50 columns)
| Name | Age | City | ... |
|------|-----|------|-----|
| John | 25  | NYC  | ... |

# Sentence serialization output
Sheet: Employees. Name is John. Age is 25. City is NYC. [all 50 cols...]
```

**Benefits:**
- Headers preserved in EVERY chunk
- Natural language (better for semantic search)
- Token-efficient (no table syntax overhead)
- Handles both many-rows AND many-columns cases

**Null handling:** Skip empty cells

**Multi-sheet handling (XLSX):**
- Process each sheet independently
- Sheet name included in each sentence

**Params:**
- `small_table_max_rows`: 35
- `small_table_max_cols`: 20
- `sentence_template`: `"{Header} is {Value}."`

---

#### Smart Number Formatting

**Problem:** Raw numbers are semantically ambiguous (10000000 = revenue? ID? phone?). Excel dates parse as serial integers.

**Solution:** Apply semantic formatting during sentence serialization.

| Data Type | Raw | Formatted |
|-----------|-----|-----------|
| Large numbers | `10000000` | `10,000,000` |
| Currency | `1500` (col: Revenue USD) | `$1,500` |
| Dates (Excel serial) | `45321` | `2024-01-25` |
| Percentages | `0.45` (col: Rate) | `45%` |
| Nulls | `null` | Skip (don't serialize) |

**Detection logic:**
- Check column header for keywords: "date", "revenue", "rate", "percent"
- Detect Excel date serials (within valid date range)
- Apply thousands separator for numbers > 999

---

## Quality-aware Chunking

**Post-chunking analysis and auto-fix for optimal chunk quality.**

### Quality Rules

| Flag | Threshold | Action |
|------|-----------|--------|
| `TOO_SHORT` | <50 chars | Merge with adjacent chunk |
| `TOO_LONG` | >2000 chars | Split with overlap |
| `NO_CONTEXT` | No heading | Inject parent heading |
| `FRAGMENT` | Mid-sentence cut | Extend to sentence boundary |
| `EMPTY` | Only whitespace | Skip, don't create chunk |

### Quality Metrics per Chunk

| Metric | Type | Description |
|--------|------|-------------|
| `char_count` | Int | Character count |
| `token_count` | Int | Token count (for LLM quota) |
| `has_heading` | Bool | Chunk starts with heading? |
| `quality_score` | Float | 0.0-1.0 composite score |
| `quality_flags` | String[] | Issue flags (TOO_SHORT, etc.) |
| `completeness` | Enum | full / partial / fragment |
| `chunk_type` | Enum | table / slide / chapter / section |

---

## Configuration

### Environment Variables

**Format-specific chunking:**
- `CHUNK_SIZE_DEFAULT`: 1000
- `CHUNK_OVERLAP_DEFAULT`: 200
- `EXCEL_MAX_ROWS_PER_CHUNK`: 35
- `EXCEL_SMALL_TABLE_THRESHOLD`: 35
- `CSV_ROWS_PER_CHUNK`: 20
- `PPTX_MIN_SLIDE_CHARS`: 200
- `EPUB_MAX_CHAPTER_SIZE`: 2000

**Quality thresholds:**
- `CHUNK_MIN_CHARS`: 50
- `CHUNK_MAX_CHARS`: 2000

**Token-based limits (Enhancement 4):**
- `CHUNK_MAX_TOKENS`: 400
- `CHUNK_OVERLAP_TOKENS`: 50
- `USE_TOKEN_BASED_CHUNKING`: true

**Embedding (same as Phase 2):**
- `EMBEDDING_MODEL`: BAAI/bge-small-en-v1.5
- `EMBEDDING_DIMENSION`: 384

---

## Database Schema Changes

### Chunk model additions

```prisma
model Chunk {
  // ... existing fields ...

  // Location metadata (REPLACE page: Int)
  location       Json?      // Flexible location schema

  // Quality metrics (NEW)
  qualityScore   Float?     @map("quality_score")
  qualityFlags   String[]   @map("quality_flags")
  chunkType      String?    @map("chunk_type")    // table/slide/chapter/section
  completeness   String?                          // full/partial/fragment
  hasTitle       Boolean?   @map("has_title")

  // Hierarchical filtering (NEW)
  breadcrumbs    String[]   // ["Chapter 1", "Section 1.2", "Subsection A"]

  // Context optimization (NEW)
  tokenCount     Int?       @map("token_count")   // Exact token count for LLM context window
}
```

### Breadcrumbs (Hierarchical Filtering)

**Problem:** Injecting headers into text improves retrieval but blocks structured filtering.

**Solution:** Store document hierarchy path as structured array.

**Example:**
```json
["Chapter 1: Introduction", "1.1 Overview", "1.1.1 Background"]
```

**Benefits:**
- Scoped search: "Search within Chapter 5 only"
- Structured queries: `WHERE breadcrumbs @> '["Chapter 5"]'`
- Complements contextual headers (stored separately for different purposes)

---

### Token Count (Context Optimization)

**Problem:** Character counts are inaccurate for LLM context limits.

**Solution:** Calculate exact token count using embedding model tokenizer at process time.

**Benefits:**
- Precise context window filling
- Accurate cost estimation
- Query-time optimization: `SUM(token_count) <= 4000`

### Flexible Location Schema

**Problem:** Flat `page: Int` is too rigid for multi-format support.

**Solution:** Use `location: Json` with format-specific structure.

| Format | Location Schema |
|--------|----------------|
| PDF | `{ "page": 1 }` |
| PPTX | `{ "slide": 5, "type": "notes" }` |
| XLSX | `{ "sheet": "Sales", "row": 15 }` |
| EPUB | `{ "chapter": 3, "title": "Chapter 3" }` |
| HTML | `{ "section": "header" }` |

**Migration:** Existing `page` field → migrate to `location: { "page": N }`

---

### Document model additions (Storage Strategy)

```prisma
model Document {
  // Existing
  filePath            String?   // Optional for Drive files (temp only)
  processedContent    String?   @db.Text
  driveFileId         String?   @unique
  
  // NEW: Cache + Link Strategy
  driveWebViewLink    String?   @map("drive_web_view_link")   // Clickable URL
  driveModifiedTime   DateTime? @map("drive_modified_time")   // Version tracking
}
```

---

## Storage Strategy for Drive Files

### Decision Table

| Source | Raw File | Processed Content | Chunks | Link |
|--------|----------|-------------------|--------|------|
| Manual Upload | Keep (optional) | Keep | Keep | N/A |
| Google Drive | **Delete after process** | Keep | Keep | Keep |

### File Cleanup Flow

```
Drive Sync
    │
    ▼
Download to temp: /tmp/ragbase/{uuid}.ext
    │
    ▼
Process: Extract → Chunk → Embed
    │
    ▼
Store: processedContent, chunks, driveWebViewLink
    │
    ▼
Delete temp file ✓
```

### Version Tracking

| Sync Event | Action |
|------------|--------|
| New file | Download → Process → Store |
| Modified (modifiedTime changed) | Re-download → Re-process → Update |
| Deleted (404) | Delete from DB or mark orphaned |
| Unchanged | Skip |

### User Access Flow

```
Search results → Show chunk content + driveWebViewLink
User clicks link → Opens Google Drive (Drive handles permissions)
```

### Environment Variables

- `DRIVE_CLEANUP_TEMP_FILES`: true
- `DRIVE_ORPHAN_STRATEGY`: "delete" | "keep" | "mark"

**No breaking changes** - all fields nullable, backward compatible.

---

## Python Dependencies (New)

```txt
openpyxl>=3.1.2       # Excel parsing
beautifulsoup4>=4.12.3 # HTML parsing
lxml>=5.1.0           # HTML/XML backend
ebooklib>=0.18        # EPUB parsing
pandas>=2.2.0         # CSV/tabular data
```

**Existing dependencies:**
- `sentence-transformers>=2.3.0`
- `torch>=2.0.0` (CPU)
- `langchain>=1.0.0`
- `docling>=2.15.0`

---

## Implementation Order

**Phase 4A: Format Processors (simplest → complex)**
1. CSV (pure tabular)
2. HTML (BeautifulSoup straightforward)
3. EPUB (chapter extraction)
4. DOCX (leverage Docling)
5. PPTX (leverage Docling)
6. XLSX (hybrid strategy)

**Phase 4B: Pre-processing Layer**
1. Implement Markdown Normalizer
2. Integrate into pipeline

**Phase 4C: Quality-aware Chunking**
1. Add quality analysis step
2. Implement auto-fix rules
3. Add quality metrics to schema
4. Populate metadata during chunking

---

## Testing Strategy

### Per-format tests
- Sample files (small/medium/large)
- Edge cases (empty sheets, malformed HTML, encrypted EPUB)
- Chunking quality (verify boundaries, metadata)
- E2E (upload → process → query)

### Quality tests
- Verify auto-fix rules trigger correctly
- Quality score calculation accuracy
- Metrics populated in database

### Regression tests
- Phase 1-3 formats still work (PDF, TXT, JSON, MD)
- Embedding quality unchanged
- API compatibility

---

## Success Criteria

Phase 4 complete when:
- ✅ All 6 formats processing end-to-end
- ✅ Markdown-first pipeline implemented
- ✅ Category-based chunking strategies working
- ✅ Pre-processing layer (normalizer) integrated
- ✅ Quality-aware chunking with auto-fix
- ✅ Quality metrics collected in database
- ✅ Zero regression in Phase 1-3 formats
- ✅ Tests passing (unit + integration + E2E)
- ✅ Documentation updated

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Markdown-first pipeline | Unified processing, single debug point |
| 3 format categories | Simpler strategy management vs per-format |
| Format-aware chunking | Faster, deterministic vs semantic chunking |
| Pre-processing normalizer | Consistent input quality for chunking |
| Quality-aware post-processing | Auto-fix common issues, track metrics |
| All new fields nullable | Backward compatible with existing data |

---

## Trade-offs

| Aspect | Chosen Approach | Alternative | Impact |
|--------|-----------------|-------------|--------|
| Chunking | Format-aware | Semantic (LLM) | 10x faster, deterministic |
| Quality fixes | Auto-fix rules | Manual tuning | Automated, consistent |
| Normalization | Pre-process step | Inline fixes | Cleaner separation |
| Categories | 3 groups | Per-format | Simpler maintenance |
