# Phase 3: Format Expansion + Chunking Optimization

**Goal:** Support 6 new document formats with format-aware chunking strategies for optimal RAG quality.

---

## New Formats

- ✅ `.docx` (Word documents)
- ✅ `.xlsx` (Excel spreadsheets)
- ✅ `.csv` (CSV files)
- ✅ `.pptx` (PowerPoint presentations)
- ✅ `.html` (Web pages)
- ✅ `.epub` (E-books)

---

## Processing Strategy by Format

| Format | Processor | Chunking Strategy | Rationale |
|--------|-----------|-------------------|-----------|
| **DOCX** | Docling | Markdown header-based | Same pipeline as PDF, respect document structure |
| **XLSX** | openpyxl | Hybrid table chunking | Small tables (≤50 rows) = single chunk, large tables = row-based with repeated headers |
| **CSV** | pandas | Row-based with headers | Each chunk includes column headers for context |
| **PPTX** | Docling | Slide-based | 1 slide = 1 chunk, group small slides (<200 chars) to avoid fragmentation |
| **HTML** | BeautifulSoup | Section-aware | Respect semantic HTML (`<section>`, `<article>`, `<div>`) |
| **EPUB** | ebooklib | Chapter-based | 1 chapter = 1 chunk, split large chapters (>2000 chars) using overlap strategy |

---

## Format-Aware Chunking Concept

### **Why Format-Aware vs Semantic?**

**Format-aware (CHOSEN):**
- Leverage natural document structure (headings, slides, chapters, tables)
- Deterministic, predictable output
- Fast processing (no LLM required)
- Easy to debug/tune per format

**Semantic chunking (REJECTED):**
- LLM-based boundary detection (slow, expensive)
- Non-deterministic (same doc → different chunks)
- Adds complexity + latency
- Not worth trade-off for this phase

---

## Chunking Strategies Details

### **1. DOCX (Word Documents)**

**Approach:** Same as PDF (Docling → markdown → header-based splitting)

**Steps:**
1. Docling converts DOCX → markdown (preserve heading hierarchy)
2. LangChain `MarkdownHeaderTextSplitter` chunks by headings
3. Default params: 1000 chars, 200 overlap

**Benefits:** Respects document structure, maintains context

---

### **2. XLSX (Excel Spreadsheets)**

**Approach:** Hybrid strategy based on table size

**Logic:**
- **Small tables (≤50 rows):** Serialize entire table as single chunk
- **Large tables (>50 rows):** Row-based chunking with headers repeated in each chunk

**Multi-sheet handling:**
- Process each sheet independently
- Metadata includes: `sheetName`, `sheetIndex`, `totalSheets`, `rowRange`

**Rationale:** Balance context (keep small tables intact) vs chunk size limits (split large tables)

**Params:**
- `max_rows_per_chunk`: 50
- `small_table_threshold`: 50

---

### **3. CSV Files**

**Approach:** Row-based chunking with column headers

**Logic:**
- Group rows into chunks (default: 20 rows/chunk)
- Include column headers in EVERY chunk
- Preserve row context via metadata

**Rationale:** Headers provide essential context for RAG retrieval

**Params:**
- `rows_per_chunk`: 20
- `include_headers`: true

---

### **4. PPTX (PowerPoint Presentations)**

**Approach:** Slide-based chunking

**Logic:**
- Default: 1 slide = 1 chunk
- Group small slides (<200 chars) to avoid fragmentation
- Metadata: slide number, slide title

**Rationale:** Slides are semantic units, grouping small slides improves context

**Params:**
- `group_small_slides`: true
- `min_slide_chars`: 200

---

### **5. HTML (Web Pages)**

**Approach:** Section-aware chunking

**Logic:**
- Respect semantic HTML structure (`<section>`, `<article>`, `<div>`)
- Extract clean text (strip navigation, ads, footers)
- Fall back to character-based if no semantic structure

**Rationale:** HTML already has semantic boundaries, use them

**Params:**
- `chunk_size`: 1000
- `chunk_overlap`: 200

---

### **6. EPUB (E-books)**

**Approach:** Chapter-based chunking

**Logic:**
- Default: 1 chapter = 1 chunk
- Split large chapters (>2000 chars) using markdown overlap strategy
- Preserve chapter metadata (title, index)

**Rationale:** Chapters are natural semantic units in books

**Params:**
- `max_chapter_size`: 2000
- `split_large_chapters`: true

---

## Chunking Quality Metrics

### **Purpose:** Track chunking effectiveness for future optimization

### **Metadata per chunk:**
- `token_count`: Number of tokens (for quota/size tracking)
- `char_count`: Character count
- `has_title`: Boolean (heading present?)
- `chunk_type`: Enum (table/slide/chapter/section/markdown_section)
- `source_page`: Page number (PDF) or slide number (PPTX)
- `completeness`: Enum (full/partial/fragment)

### **Use cases:**
- Identify low-quality chunks (fragments, no context)
- Adjust chunking params per format based on metrics
- Analytics dashboard showing chunk distribution

---

## Configuration

### **Environment Variables:**

**Format-specific chunking:**
- `CHUNK_SIZE_DEFAULT`: 1000
- `CHUNK_OVERLAP_DEFAULT`: 200
- `EXCEL_MAX_ROWS_PER_CHUNK`: 50
- `EXCEL_SMALL_TABLE_THRESHOLD`: 50
- `CSV_ROWS_PER_CHUNK`: 20
- `PPTX_MIN_SLIDE_CHARS`: 200
- `EPUB_MAX_CHAPTER_SIZE`: 2000

**Processing (same as Phase 2):**
- `EMBEDDING_MODEL`: BAAI/bge-small-en-v1.5
- `EMBEDDING_DIMENSION`: 384

---

## Python Dependencies (New)

**Document processing libraries:**
- `openpyxl>=3.1.2` - Excel file parsing
- `beautifulsoup4>=4.12.3` - HTML parsing
- `lxml>=5.1.0` - HTML/XML parsing backend
- `ebooklib>=0.18` - EPUB parsing
- `pandas>=2.2.0` - CSV/tabular data (efficient)

**Existing dependencies:**
- `sentence-transformers>=2.3.0`
- `torch>=2.0.0` (CPU)
- `langchain>=1.0.0`
- `docling>=2.15.0`

---

## Implementation Strategy

### **Phase 3A: Add format processors (one at a time)**

**Order (simplest → most complex):**
1. CSV (easiest - pure tabular)
2. HTML (moderate - BeautifulSoup straightforward)
3. EPUB (moderate - chapter extraction)
4. DOCX (leverage existing Docling)
5. PPTX (leverage existing Docling)
6. XLSX (most complex - hybrid strategy)

**Per-format checklist:**
- Add processor function
- Implement chunking strategy
- Add metadata extraction
- Unit tests (sample files)
- Integration tests (upload → process → query)

### **Phase 3B: Quality metrics collection**

- Add metadata fields to chunk schema
- Populate metadata during chunking
- Create analytics queries

---

## Database Schema Changes

### **Chunk model additions:**
- `chunkType` (String?): table/slide/chapter/section
- `completeness` (String?): full/partial/fragment
- `hasTitle` (Boolean?): Heading present

**No breaking changes** - all fields nullable, backward compatible.

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| **Format-aware chunking** | Faster, deterministic, easier to debug than semantic |
| **No semantic chunking** | Too complex for Phase 3, deferred to future |
| **DOCX = PDF pipeline** | Leverage existing Docling investment |
| **Hybrid Excel strategy** | Balance context vs size constraints |
| **Multi-sheet processing** | Each sheet independent with metadata |
| **Slide-based PPTX** | Natural semantic unit, group small slides |
| **Section-aware HTML** | Use existing semantic structure |
| **Chapter-based EPUB** | Books already have natural chapters |
| **Quality metrics** | Enable future optimization, low overhead |
| **No chunk preview API** | System handles automatically, reduces scope |

---

## Testing Strategy

### **Per-format tests:**
- Sample files (small/medium/large)
- Edge cases (empty sheets, malformed HTML, encrypted EPUB)
- Chunking quality (verify boundaries, metadata)
- E2E (upload → query → results)

### **Regression tests:**
- Phase 1/2 formats still work (PDF, TXT, JSON, MD)
- Embedding quality unchanged
- API compatibility

---

## Success Criteria

**Phase 3 complete when:**
- ✅ All 6 formats processing end-to-end
- ✅ Format-aware chunking strategies implemented
- ✅ Quality metrics collected in database
- ✅ Zero regression in Phase 1/2 formats
- ✅ Tests passing (unit + integration + E2E)
- ✅ Documentation updated (api.md, architecture.md)

---

## Trade-offs

| Aspect | Format-aware | Semantic (rejected) | Impact |
|--------|--------------|---------------------|--------|
| **Quality** | Good (80-85%) | Better (90%+) | Acceptable for Phase 3 |
| **Speed** | Fast (<1s/doc) | Slow (5-10s/doc) | 10x faster |
| **Determinism** | Deterministic | Non-deterministic | Easier debugging |
| **Complexity** | Low (format parsers) | High (LLM integration) | Faster to ship |
| **Cost** | $0 (self-hosted) | $0.01-0.05/doc (LLM) | Zero operational cost |

**Conclusion:** Format-aware is optimal trade-off for Phase 3. Semantic chunking deferred to Phase 5+.
