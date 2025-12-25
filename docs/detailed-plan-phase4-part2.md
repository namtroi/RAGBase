# Phase 4 Detailed Implementation Plan - Part 2

**Chunking + Quality + Schema + Integration** | **TDD Approach**

---

## Overview

| Part | Name | Description | Status |
|------|------|-------------|--------|
| **4C.1** | Document Chunker | Header-based splitting with breadcrumbs | ⬜ Pending |
| **4C.2** | Presentation Chunker | Slide-based splitting | ⬜ Pending |
| **4C.3** | Tabular Chunker | Row-based splitting | ⬜ Pending |
| **4D.1** | Quality Analyzer | Analyze chunks, assign flags/scores | ⬜ Pending |
| **4D.2** | Auto-Fix Rules | Merge short, split long, inject context | ⬜ Pending |
| **4E.1** | Database Migration | Add quality fields to Chunk model | ⬜ Pending |
| **4E.2** | Backend API Updates | New formats, category filters | ⬜ Pending |
| **4E.3** | Callback Schema Update | Accept quality metadata | ⬜ Pending |
| **4F** | Integration Tests | E2E + Regression tests | ⬜ Pending |

**Part 1:** See `detailed-plan-phase4-part1.md` for Pre-processing and Format Processors.

---

## Part 4C: Category-Based Chunking

### 4C.1 Document Chunker (Header-based)

**Status:** Pending  
**Implementation:** `apps/ai-worker/src/chunkers/document_chunker.py`

### TDD Steps:

1. **Write unit tests**
   ```python
   # tests/test_document_chunker.py
   class TestDocumentChunker:
       # Header splitting
       def test_split_by_h1()
       def test_split_by_h2()
       def test_split_by_h3()
       
       # Breadcrumbs
       def test_breadcrumbs_h1_only()
       def test_breadcrumbs_nested()
       def test_inject_breadcrumb_header()
       
       # Recursive fallback
       def test_fallback_no_headings()
       def test_fallback_large_section()
       
       # Sentence boundaries
       def test_preserve_sentence_integrity()
       
       # Edge cases
       def test_empty_text()
       def test_whitespace_only()
   ```

2. **Implement chunker**
   - Use `MarkdownHeaderTextSplitter` for H1/H2/H3
   - Build breadcrumbs array from header hierarchy
   - Fallback to `RecursiveCharacterTextSplitter` for large sections
   - Respect max_tokens limit

### Files:
- `apps/ai-worker/src/chunkers/document_chunker.py`
- `apps/ai-worker/tests/test_document_chunker.py`

---

### 4C.2 Presentation Chunker (Slide-based)

**Status:** Pending  
**Implementation:** `apps/ai-worker/src/chunkers/presentation_chunker.py`

### TDD Steps:

1. **Write unit tests**
   ```python
   # tests/test_presentation_chunker.py
   class TestPresentationChunker:
       def test_one_slide_one_chunk()
       def test_slide_markers()
       def test_group_small_slides()
       def test_no_group_if_disabled()
       def test_slide_number_metadata()
       def test_empty_text()
   ```

2. **Implement chunker**
   - Split by `<!-- slide -->` markers
   - Group small slides (<200 chars) with next
   - Include slide number in location metadata

### Files:
- `apps/ai-worker/src/chunkers/presentation_chunker.py`
- `apps/ai-worker/tests/test_presentation_chunker.py`

---

### 4C.3 Tabular Chunker (Row-based)

**Status:** Pending  
**Implementation:** `apps/ai-worker/src/chunkers/tabular_chunker.py`

### TDD Steps:

1. **Write unit tests**
   ```python
   # tests/test_tabular_chunker.py
   class TestTabularChunker:
       def test_small_table_single_chunk()
       def test_large_table_multiple_chunks()
       def test_markdown_table_single_chunk()
       def test_chunk_type_is_table()
       def test_empty_text()
   ```

2. **Implement chunker**
   - Markdown table format → single chunk
   - Sentence format → split by `rows_per_chunk` (default: 20)
   - Include sheet name in breadcrumbs

### Files:
- `apps/ai-worker/src/chunkers/tabular_chunker.py`
- `apps/ai-worker/tests/test_tabular_chunker.py`

---

## Part 4D: Quality-Aware Post-Processing

### 4D.1 Quality Analyzer

**Status:** Pending  
**Implementation:** `apps/ai-worker/src/quality/analyzer.py`

### TDD Steps:

1. **Write unit tests**
   ```python
   # tests/test_quality_analyzer.py
   class TestQualityAnalyzer:
       # Flags
       def test_flag_too_short()      # <50 chars
       def test_flag_too_long()       # >2000 chars
       def test_flag_no_context()     # No heading, no breadcrumbs
       def test_flag_fragment()       # Mid-sentence cut
       def test_flag_empty()          # Whitespace only
       
       # Score
       def test_perfect_score()       # No issues → 1.0
       def test_penalty_per_flag()    # Each flag reduces score
       
       # Metrics
       def test_char_count()
       def test_has_title_true()
       def test_has_title_false()
   ```

2. **Implement analyzer**
   - Check: TOO_SHORT, TOO_LONG, NO_CONTEXT, FRAGMENT, EMPTY
   - Calculate score: 1.0 - (penalty per flag)
   - Return: flags, score, char_count, has_title, completeness

### Files:
- `apps/ai-worker/src/quality/analyzer.py`
- `apps/ai-worker/tests/test_quality_analyzer.py`

---

### 4D.2 Auto-Fix Rules

**Status:** Pending  
**Implementation:** `apps/ai-worker/src/quality/auto_fix.py`

### TDD Steps:

1. **Write unit tests**
   ```python
   # tests/test_auto_fix.py
   class TestAutoFix:
       def test_split_too_long_first()  # SPLIT before MERGE
       def test_merge_too_short()       # Merge with adjacent
       def test_skip_empty()            # Remove from output
       def test_inject_context()        # Add breadcrumb header
       def test_max_passes_limit()      # No infinite loops
       def test_reindex_after_fix()     # Correct indices
   ```

2. **Implement fixer** (order matters!)
   - **Pass 1: SPLIT** all TOO_LONG chunks first
   - **Pass 2: MERGE** all TOO_SHORT chunks
   - EMPTY → skip
   - NO_CONTEXT → inject breadcrumb as context header
   - **Max 2 passes** to prevent infinite loops
   - Re-index chunks after fixes

### Files:
- `apps/ai-worker/src/quality/auto_fix.py`
- `apps/ai-worker/tests/test_auto_fix.py`

---

## Part 4E: Schema & API Updates

### 4E.1 Database Migration

**Status:** Pending  
**Implementation:** `apps/backend/prisma/schema.prisma`

### TDD Steps:

1. **Update Prisma schema**
   ```prisma
   model Document {
     formatCategory      String?   @map("format_category")
     driveWebViewLink    String?   @map("drive_web_view_link")
     driveModifiedTime   DateTime? @map("drive_modified_time")
   }
   
   model Chunk {
     location       Json?      @db.JsonB
     qualityScore   Float?     @map("quality_score")
     qualityFlags   String[]   @map("quality_flags") @default([])
     chunkType      String?    @map("chunk_type")
     completeness   String?
     hasTitle       Boolean?   @map("has_title")
     breadcrumbs    String[]   @default([])
     tokenCount     Int?       @map("token_count")
     
     @@index([qualityScore])
     @@index([chunkType])
   }
   ```

2. **Run migration**
   ```bash
   cd apps/backend
   npx prisma migrate dev --name phase4_format_expansion
   ```

### Files:
- `apps/backend/prisma/schema.prisma`

---

### 4E.2 Backend API Updates

**Status:** Pending  
**Implementation:** Multiple routes

### TDD Steps:

1. **Update format validator**
   ```typescript
   // tests/unit/validators/document-schema.test.ts
   it('should accept docx format')
   it('should accept xlsx format')
   it('should accept csv format')
   it('should accept pptx format')
   it('should accept html format')
   it('should accept epub format')
   ```

2. **Update list route**
   ```typescript
   // tests/integration/routes/documents/list-route.test.ts
   it('should filter by formatCategory')
   it('should return category counts')
   ```

3. **Add formats to validator**
   ```typescript
   const ALLOWED_FORMATS = [
     'pdf', 'json', 'txt', 'md',
     'docx', 'xlsx', 'csv', 'pptx', 'html', 'epub',
   ];
   ```

### Files:
- `apps/backend/src/validators/document-schema.ts`
- `apps/backend/src/routes/documents/list-route.ts`
- `apps/backend/tests/unit/validators/document-schema.test.ts`
- `apps/backend/tests/integration/routes/documents/list-route.test.ts`

---

### 4E.3 Callback Schema Update

**Status:** Pending  
**Implementation:** `apps/backend/src/routes/internal/callback-route.ts`

### TDD Steps:

1. **Update callback tests**
   ```typescript
   // tests/integration/routes/internal/callback-route.test.ts
   it('should accept formatCategory field')
   it('should accept quality metadata in chunks')
   it('should store breadcrumbs array')
   it('should store qualityScore')
   ```

2. **Update callback schema**
   - Accept: `formatCategory`, `qualityMetrics`
   - Accept chunk metadata: `location`, `breadcrumbs`, `qualityScore`, `qualityFlags`, `chunkType`, `tokenCount`

### Files:
- `apps/backend/src/routes/internal/callback-route.ts`
- `apps/backend/tests/integration/routes/internal/callback-route.test.ts`

---

## Part 4F: Integration & Testing

### E2E Tests

**Status:** Pending  
**Implementation:** `apps/ai-worker/tests/e2e/`

### TDD Steps:

1. **Write E2E tests**
   ```python
   # tests/e2e/test_format_processing.py
   @pytest.mark.parametrize("format_type,fixture_file", [
       ("csv", "fixtures/csv/simple.csv"),
       ("html", "fixtures/html/simple.html"),
       ("xlsx", "fixtures/xlsx/simple.xlsx"),
       ("epub", "fixtures/epub/simple.epub"),
   ])
   def test_format_processing(format_type, fixture_file):
       # Upload → Process → Verify chunks created
   ```

### Files:
- `apps/ai-worker/tests/e2e/test_format_processing.py`
- `apps/ai-worker/tests/fixtures/`

---

### Regression Tests

**Status:** Pending  
**Implementation:** `apps/ai-worker/tests/regression/`

### TDD Steps:

1. **Write regression tests**
   ```python
   # tests/regression/test_existing_formats.py
   class TestRegression:
       def test_pdf_still_works()
       def test_txt_still_works()
       def test_md_still_works()
       def test_json_still_works()
       def test_embedding_dimensions_unchanged()  # 384
   ```

### Files:
- `apps/ai-worker/tests/regression/test_existing_formats.py`

---

## Test Commands

```bash
cd apps/ai-worker

# Phase 4C: Chunking
pytest tests/test_document_chunker.py tests/test_presentation_chunker.py tests/test_tabular_chunker.py -v

# Phase 4D: Quality
pytest tests/test_quality_analyzer.py tests/test_auto_fix.py -v

# Phase 4F: E2E & Regression
pytest tests/e2e/ tests/regression/ -v

# Backend tests
cd apps/backend && pnpm test
```

---

## Implementation Order

```
4C.1 (Document) → 4C.2 (Presentation) → 4C.3 (Tabular)
                          ↓
          4D.1 (Analyzer) → 4D.2: (Auto-Fix)
                          ↓
    4E.1 (Migration) → 4E.2 (API) → 4E.3 (Callback)
                          ↓
                    4F (E2E + Regression)
```

Dependencies:
- 4C can start after Part 1 (4A, 4B) complete
- 4D depends on 4C
- 4E can run in parallel with 4C/4D
- 4F runs last

---

## Estimated Timeline

| Part | Estimated | Description |
|------|-----------|-------------|
| 4C.1 | 3h | Document Chunker |
| 4C.2 | 2h | Presentation Chunker |
| 4C.3 | 2h | Tabular Chunker |
| 4D.1 | 2h | Quality Analyzer |
| 4D.2 | 2h | Auto-Fix Rules |
| 4E.1 | 1h | DB Migration |
| 4E.2 | 2h | Backend API |
| 4E.3 | 1h | Callback Update |
| 4F | 2h | E2E + Regression |
| **Total** | **~17h** | |

---

## Directory Structure After Phase 4

```
apps/ai-worker/src/
├── sanitizer.py          # 4A.1
├── normalizer.py         # 4A.2
├── csv_processor.py      # 4B.1
├── html_processor.py     # 4B.2
├── epub_processor.py     # 4B.3
├── pptx_processor.py     # 4B.5
├── xlsx_processor.py     # 4B.6
├── chunkers/
│   ├── document_chunker.py      # 4C.1
│   ├── presentation_chunker.py  # 4C.2
│   └── tabular_chunker.py       # 4C.3
└── quality/
    ├── analyzer.py       # 4D.1
    └── auto_fix.py       # 4D.2
```

---

**Part 2 Status:** ⬜ PENDING

**Combined Timeline:** Part 1 (~14h) + Part 2 (~17h) = **~31h total**
