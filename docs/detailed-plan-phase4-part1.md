# Phase 4 Detailed Implementation Plan - Part 1

**Format Processors + Pre-processing** | **TDD Approach**

---

## Overview

| Part | Name | Description | Status |
|------|------|-------------|--------|
| **4A** | Pre-processing Layer | Input sanitizer + Markdown normalizer | ✅ Complete |
| **4B.1** | CSV Processor | Parse CSV → Markdown (table or sentence) | ✅ Complete |
| **4B.2** | HTML Processor | HTML → Markdown via BeautifulSoup | ✅ Complete |
| **4B.3** | EPUB Processor | EPUB chapters → Markdown | ✅ Complete |
| **4B.4** | DOCX Processor | Docling DOCX support | ⬜ Pending |
| **4B.5** | PPTX Processor | Docling PPTX + slide markers | ⬜ Pending |
| **4B.6** | XLSX Processor | Multi-sheet Excel → Markdown | ⬜ Pending |

**Part 2:** See `detailed-plan-phase4-part2.md` for Chunking, Quality, Schema, Integration.

---

## Prerequisites

### 1. Add Dependencies

```bash
# apps/ai-worker/requirements.txt - ADD
openpyxl>=3.1.2
beautifulsoup4>=4.12.3
lxml>=5.1.0
ebooklib>=0.18
pandas>=2.2.0
markdownify>=0.11.6
ftfy>=6.1.0
chardet>=5.2.0
```

### 2. Add ProcessorOutput Model

```python
# apps/ai-worker/src/models.py - ADD
@dataclass
class ProcessorOutput:
    markdown: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    page_count: Optional[int] = None
    slide_count: Optional[int] = None
    sheet_count: Optional[int] = None
    chapter_count: Optional[int] = None
```

### 3. Create Test Fixtures

```bash
mkdir -p apps/ai-worker/tests/fixtures/{csv,html,epub,docx,pptx,xlsx}
```

---

## Part 4A: Pre-processing Layer

**Status:** Pending  
**Implementation:** `apps/ai-worker/src/sanitizer.py`, `apps/ai-worker/src/normalizer.py`

### 4A.1 Input Sanitizer

### TDD Steps:

1. **Write unit tests**
   ```python
   # tests/test_sanitizer.py
   class TestInputSanitizer:
       def test_remove_null_bytes()
       def test_remove_control_chars()
       def test_preserve_newlines_tabs()
       def test_normalize_nfc()
       def test_fix_mojibake()
       def test_remove_bom()
       def test_normalize_line_endings()
       def test_strip_trailing_whitespace()
   ```

2. **Implement sanitizer**
   - Remove `\x00` null bytes
   - Remove control chars `\x01-\x1f` (keep `\n`, `\t`)
   - Normalize to NFC unicode
   - Fix mojibake with `ftfy`
   - Strip BOM and trailing whitespace

### Files:
- `apps/ai-worker/src/sanitizer.py`
- `apps/ai-worker/tests/test_sanitizer.py`

---

### 4A.2 Markdown Normalizer

### TDD Steps:

1. **Write unit tests**
   ```python
   # tests/test_normalizer.py
   class TestMarkdownNormalizer:
       def test_normalize_heading_gaps()
       def test_remove_empty_sections()
       def test_collapse_blank_lines()
       def test_standardize_bullets()
       def test_preserve_code_blocks()
       def test_fix_unclosed_code_blocks()
   ```

2. **Implement normalizer**
   - Collapse multiple blank lines to max 2
   - Standardize bullets `*`, `+` → `-`
   - Remove empty sections (heading with no content)
   - Fix unclosed code blocks
   - Preserve content inside code blocks

### Files:
- `apps/ai-worker/src/normalizer.py`
- `apps/ai-worker/tests/test_normalizer.py`

---

## Part 4B: Format Processors

### Format Routing in main.py

```python
# apps/ai-worker/src/main.py - ADD
FORMAT_PROCESSORS = {
    'pdf': pdf_processor,
    'docx': pdf_processor,      # Docling
    'pptx': pptx_processor,
    'txt': text_processor,
    'md': text_processor,
    'json': text_processor,
    'csv': csv_processor,
    'html': html_processor,
    'epub': epub_processor,
    'xlsx': xlsx_processor,
}

FORMAT_CATEGORIES = {
    'pdf': 'DOCUMENT', 'docx': 'DOCUMENT', 'txt': 'DOCUMENT',
    'md': 'DOCUMENT', 'html': 'DOCUMENT', 'epub': 'DOCUMENT',
    'pptx': 'PRESENTATION',
    'xlsx': 'TABULAR', 'csv': 'TABULAR', 'json': 'TABULAR',
}
```

---

## Part 4B.1: CSV Processor

**Status:** Pending  
**Implementation:** `apps/ai-worker/src/csv_processor.py`

### TDD Steps:

1. **Write unit tests**
   ```python
   # tests/test_csv_processor.py
   class TestCsvProcessor:
       # Basic parsing
       def test_parse_simple_csv()
       def test_parse_empty_csv()
       
       # Encoding
       def test_parse_utf8_csv()
       def test_parse_latin1_csv()
       def test_parse_bom_csv()
       
       # Delimiter detection
       def test_detect_comma_delimiter()
       def test_detect_semicolon_delimiter()
       def test_detect_tab_delimiter()
       
       # Edge cases
       def test_quoted_fields()
       def test_multiline_fields()
       
       # Size thresholds
       def test_small_table_markdown_format()  # ≤35 rows
       def test_large_table_sentence_format()  # >35 rows
   ```

2. **Implement processor**
   - Auto-detect encoding with `chardet`
   - Auto-detect delimiter with `csv.Sniffer`
   - **Use `pandas.read_csv(..., chunksize=10000)` for streaming large files (OOM prevention)**
   - Small table (≤35 rows, ≤20 cols) → Markdown table
   - Large table → Sentence format: `"{Header} is {Value}."`
   - **Apply smart number formatting** (same as XLSX: commas, dates, percentages)

### Files:
- `apps/ai-worker/src/csv_processor.py`
- `apps/ai-worker/tests/test_csv_processor.py`

---

## Part 4B.2: HTML Processor

**Status:** Pending  
**Implementation:** `apps/ai-worker/src/html_processor.py`

### TDD Steps:

1. **Write unit tests**
   ```python
   # tests/test_html_processor.py
   class TestHtmlProcessor:
       # Basic extraction
       def test_extract_body_content()
       def test_preserve_heading_hierarchy()
       def test_convert_paragraphs()
       
       # Lists
       def test_convert_unordered_list()
       def test_convert_ordered_list()
       def test_convert_nested_lists()
       
       # Tables
       def test_convert_table()
       
       # Links & Code
       def test_convert_links()
       def test_convert_code_blocks()
       
       # Cleanup
       def test_remove_scripts()
       def test_remove_styles()
       def test_remove_comments()
   ```

2. **Implement processor**
   - Parse with `BeautifulSoup` + `lxml`
   - Remove: `script`, `style`, `nav`, `footer`, `aside`
   - Convert to markdown with `markdownify`

### Files:
- `apps/ai-worker/src/html_processor.py`
- `apps/ai-worker/tests/test_html_processor.py`

---

## Part 4B.3: EPUB Processor

**Status:** Pending  
**Implementation:** `apps/ai-worker/src/epub_processor.py`

### TDD Steps:

1. **Write unit tests**
   ```python
   # tests/test_epub_processor.py
   class TestEpubProcessor:
       # Structure
       def test_extract_chapters()
       def test_chapter_titles_as_headings()
       def test_chapter_separation()
       
       # Edge cases
       def test_skip_toc_chapter()
       def test_skip_cover_page()
       def test_unicode_content()
       
       # Errors
       def test_file_not_found()
   ```

2. **Implement processor**
   - Read with `ebooklib`
   - Extract `ITEM_DOCUMENT` items
   - Skip toc, cover, nav items
   - Convert chapter HTML to markdown
   - Separate chapters with `---`

### Files:
- `apps/ai-worker/src/epub_processor.py`
- `apps/ai-worker/tests/test_epub_processor.py`

---

## Part 4B.4: DOCX Processor

**Status:** Pending  
**Implementation:** Update `apps/ai-worker/src/processor.py`

### TDD Steps:

1. **Write unit tests**
   ```python
   # tests/test_processor.py - ADD
   class TestDocxProcessor:
       def test_extract_paragraphs()
       def test_preserve_headings()
       def test_preserve_lists()
       def test_convert_tables()
       def test_password_protected_error()
   ```

2. **Update Docling converter**
   - Add `InputFormat.DOCX` to allowed formats
   - Reuse existing `PDFProcessor` infrastructure

### Files:
- `apps/ai-worker/src/processor.py` (update)
- `apps/ai-worker/tests/test_processor.py` (add tests)

---

## Part 4B.5: PPTX Processor

**Status:** Pending  
**Implementation:** `apps/ai-worker/src/pptx_processor.py`

### TDD Steps:

1. **Write unit tests**
   ```python
   # tests/test_pptx_processor.py
   class TestPptxProcessor:
       # Slides
       def test_extract_all_slides()
       def test_slide_separation()
       def test_slide_titles()
       
       # Content
       def test_extract_text_boxes()
       def test_extract_bullet_points()
       def test_extract_tables()
       
       # Notes
       def test_include_speaker_notes()
       
       # Edge cases
       def test_empty_slide()
   ```

2. **Implement processor**
   - Use Docling for PPTX conversion
   - Add slide markers `<!-- slide -->`
   - Include slide number in metadata

### Files:
- `apps/ai-worker/src/pptx_processor.py`
- `apps/ai-worker/tests/test_pptx_processor.py`

---

## Part 4B.6: XLSX Processor

**Status:** Pending  
**Implementation:** `apps/ai-worker/src/xlsx_processor.py`

### TDD Steps:

1. **Write unit tests**
   ```python
   # tests/test_xlsx_processor.py
   class TestXlsxProcessor:
       # Multi-sheet
       def test_process_all_sheets()
       def test_sheet_names_as_headers()
       def test_skip_empty_sheets()
       
       # Small tables
       def test_small_table_markdown()
       
       # Large tables
       def test_large_table_sentences()
       def test_sentence_template()
       
       # Data types
       def test_number_formatting()
       def test_date_conversion()
       def test_skip_null_cells()
       
       # Edge cases
       def test_password_protected()
   ```

2. **Implement processor**
   - **Use `openpyxl.load_workbook(..., read_only=True)` for memory efficiency (OOM prevention)**
   - Read all sheets with `pandas`
   - Sheet name as H1 heading
   - Small table → Markdown table
   - Large table → Sentence format with smart formatting

### Files:
- `apps/ai-worker/src/xlsx_processor.py`
- `apps/ai-worker/tests/test_xlsx_processor.py`

---

## Test Commands

```bash
cd apps/ai-worker

# Run all Phase 4A-4B tests
pytest tests/test_sanitizer.py tests/test_normalizer.py -v
pytest tests/test_csv_processor.py tests/test_html_processor.py -v
pytest tests/test_epub_processor.py tests/test_pptx_processor.py -v
pytest tests/test_xlsx_processor.py -v

# Run with coverage
pytest tests/ -v --cov=src --cov-report=term-missing
```

---

## Implementation Order

```
4A (Pre-processing) → 4B.1 (CSV) → 4B.2 (HTML) → 4B.3 (EPUB)
                           ↓
                    4B.4 (DOCX) → 4B.5 (PPTX) → 4B.6 (XLSX)
```

Dependencies:
- 4A must complete first (sanitizer/normalizer used by all processors)
- 4B.1-4B.6 can run in parallel after 4A

---

## Estimated Timeline

| Part | Estimated | Description |
|------|-----------|-------------|
| 4A | 2h | Sanitizer + Normalizer |
| 4B.1 | 2h | CSV Processor |
| 4B.2 | 2h | HTML Processor |
| 4B.3 | 2h | EPUB Processor |
| 4B.4 | 1h | DOCX (Docling update) |
| 4B.5 | 2h | PPTX Processor |
| 4B.6 | 3h | XLSX Processor |
| **Total** | **~14h** | |

---

**Part 1 Status:** ⬜ PENDING

**Next:** `detailed-plan-phase4-part2.md`
