# Phase 4 Detailed Implementation Plan - Part 2

**Chunking + Quality + Schema + Integration** | **TDD Approach**

---

## Overview

| Part | Name | Description | Status |
|------|------|-------------|--------|
| **4C.1** | Document Chunker | Header-based splitting with breadcrumbs | ✅ Complete |
| **4C.2** | Presentation Chunker | Slide-based splitting | ✅ Complete |
| **4C.3** | Tabular Chunker | Row-based splitting | ✅ Complete |
| **4D.1** | Quality Analyzer | Analyze chunks, assign flags/scores | ✅ Complete |
| **4D.2** | Auto-Fix Rules | Merge short, split long, inject context | ✅ Complete |
| **4E.1** | Database Migration | Add quality fields to Chunk model | ✅ Complete |
| **4E.2** | Backend API Updates | New formats, category filters | ✅ Complete |
| **4E.3** | Callback Schema Update | Accept quality metadata | ✅ Complete |
| **4F** | Integration Tests | E2E + Regression tests | ✅ Complete |

**Part 1:** See `detailed-plan-phase4-part1.md` for Pre-processing and Format Converters.

---

## Architecture (Post-Refactor)

### Unified Pipeline

```python
# src/pipeline.py
class ProcessingPipeline:
    def run(self, markdown: str, category: str) -> List[Dict]:
        # 1. Sanitize
        markdown = self.sanitizer.sanitize(markdown)
        
        # 2. Chunk (category-based)
        if category == "presentation":
            chunks = self.presentation_chunker.chunk(markdown)
        elif category == "tabular":
            chunks = self.tabular_chunker.chunk(markdown)
        else:
            chunks = self.document_chunker.chunk(markdown)
        
        # 3. Quality analysis
        for chunk in chunks:
            quality = self.analyzer.analyze(chunk)
            chunk["metadata"]["qualityScore"] = quality["score"]
            chunk["metadata"]["qualityFlags"] = quality["flags"]
            # ...
        
        # 4. Embeddings + token count
        embeddings = self.embedder.embed(texts)
        token_counts = self.embedder.get_token_counts(texts)
```

---

## Part 4C: Category-Based Chunking

### 4C.1 Document Chunker

**Status:** ✅ Complete  
**File:** `src/chunkers/document_chunker.py`

### Features:
- Split by H1/H2/H3 with `MarkdownHeaderTextSplitter`
- Build breadcrumbs array from header hierarchy
- Fallback to `RecursiveCharacterTextSplitter` for large sections
- Track `charStart`/`charEnd` positions

---

### 4C.2 Presentation Chunker

**Status:** ✅ Complete  
**File:** `src/chunkers/presentation_chunker.py`

### Features:
- Split by `<!-- slide -->` markers
- Group small slides (<200 chars)
- Include slide number in location metadata
- Track `charStart`/`charEnd` positions

---

### 4C.3 Tabular Chunker

**Status:** ✅ Complete  
**File:** `src/chunkers/tabular_chunker.py`

### Features:
- Markdown table format → single chunk
- Sentence format → split by `rows_per_chunk` (default: 20)
- Include sheet name in breadcrumbs
- Track `charStart`/`charEnd` positions

---

## Part 4D: Quality-Aware Post-Processing

### 4D.1 Quality Analyzer

**Status:** ✅ Complete  
**File:** `src/quality/analyzer.py`

### Flags:
- `TOO_SHORT` (<50 chars)
- `TOO_LONG` (>2000 chars)
- `NO_CONTEXT` (no heading, no breadcrumbs)
- `FRAGMENT` (mid-sentence cut)
- `EMPTY` (whitespace only)

### Score:
- Base: 1.0
- Penalty: -0.15 per flag

### Output:
- `flags`, `score`, `char_count`, `has_title`, `completeness`

---

### 4D.2 Auto-Fix Rules

**Status:** ✅ Complete  
**File:** `src/quality/auto_fix.py`

### Order of Operations:
1. **SPLIT** all TOO_LONG chunks first
2. **MERGE** all TOO_SHORT chunks
3. **SKIP** EMPTY chunks
4. **INJECT** context for NO_CONTEXT chunks
5. **Max 2 passes** to prevent infinite loops
6. Re-index chunks after fixes

---

## Part 4E: Schema & API Updates

### 4E.1 Database Schema

**Status:** ✅ Complete  
**File:** `apps/backend/prisma/schema.prisma`

```prisma
model Document {
  formatCategory  String?  @map("format_category")
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

---

### 4E.2 Backend API Updates

**Status:** ✅ Complete

### Files Updated:
- `src/validators/file-format-detector.ts` - New formats
- `src/validators/upload-validator.ts` - Accept new formats
- `src/routes/documents/content-route.ts` - Return quality metadata in JSON

### Allowed Formats:
```typescript
['pdf', 'json', 'txt', 'md', 'docx', 'xlsx', 'csv', 'pptx', 'html', 'epub']
```

---

### 4E.3 Callback Schema Update

**Status:** ✅ Complete  
**Files:** `src/routes/internal/callback-route.ts`, `src/validators/callback-validator.ts`

### Accepts:
- `formatCategory`
- Chunk metadata: `location`, `breadcrumbs`, `qualityScore`, `qualityFlags`, `chunkType`, `tokenCount`, `completeness`, `hasTitle`

---

## Part 4F: Integration & Testing

### E2E Tests

**Status:** ✅ Complete  
**File:** `tests/e2e/test_format_processing.py`

### Tested Formats:
- CSV, HTML, XLSX, EPUB, PPTX

---

### Regression Tests

**Status:** ✅ Complete  
**File:** `tests/regression/test_existing_formats.py`

### Tested:
- PDF, TXT, MD, JSON still work
- Embedding dimensions unchanged (384)
- Chunk structure valid

---

## Post-Phase 4 Enhancements

### 1. Auto-Delete Source Files
**Status:** ✅ Complete  
**File:** `src/main.py`

After successful processing, source file is deleted to save disk space.

### 2. Token Count
**Status:** ✅ Complete  
**File:** `src/embedder.py`

Uses model's tokenizer for 100% accurate token counts.

### 3. Strategy Pattern Refactor
**Status:** ✅ Complete

Refactored monolithic processors into:
- `converters/` - 7 format converters
- `pipeline.py` - Unified processing
- `router.py` - Format routing

---

## Test Commands

```bash
cd apps/ai-worker

# All tests
pytest tests/ -v --cov=src --cov-report=term-missing

# Specific categories
pytest tests/test_document_chunker.py tests/test_presentation_chunker.py tests/test_tabular_chunker.py -v
pytest tests/test_quality_analyzer.py tests/test_auto_fix.py -v
pytest tests/e2e/ tests/regression/ -v

# Backend
cd apps/backend && pnpm test:unit && pnpm test:integration
```

---

## Final Directory Structure

```
apps/ai-worker/src/
├── main.py                  # FastAPI endpoints + auto-delete
├── router.py                # Format → Converter mapping
├── pipeline.py              # Unified pipeline
├── sanitizer.py             # Input sanitization
├── normalizer.py            # Markdown normalization
├── embedder.py              # Embeddings + token count
├── converters/
│   ├── base.py              # FormatConverter ABC
│   ├── pdf_converter.py     # PDF/DOCX
│   ├── text_converter.py    # TXT/MD/JSON
│   ├── csv_converter.py
│   ├── html_converter.py
│   ├── epub_converter.py
│   ├── pptx_converter.py
│   └── xlsx_converter.py
├── chunkers/
│   ├── document_chunker.py
│   ├── presentation_chunker.py
│   └── tabular_chunker.py
└── quality/
    ├── analyzer.py
    └── auto_fix.py
```

---

## Test Results (Final)

```
AI Worker:  169 passed, 87% coverage
Backend:    150 unit, 116 integration, 13 e2e passed
```

---

**Part 2 Status:** ✅ COMPLETE

**Phase 4 Status:** ✅ COMPLETE
