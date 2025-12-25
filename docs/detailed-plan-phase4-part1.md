# Phase 4 Detailed Implementation Plan - Part 1

**Format Converters + Pre-processing** | **TDD Approach**

---

## Overview

| Part | Name | Description | Status |
|------|------|-------------|--------|
| **4A** | Pre-processing Layer | Input sanitizer + Markdown normalizer | ✅ Complete |
| **4B.1** | CSV Converter | Parse CSV → Markdown (table or sentence) | ✅ Complete |
| **4B.2** | HTML Converter | HTML → Markdown via BeautifulSoup | ✅ Complete |
| **4B.3** | EPUB Converter | EPUB chapters → Markdown | ✅ Complete |
| **4B.4** | PDF/DOCX Converter | Docling PDF/DOCX support | ✅ Complete |
| **4B.5** | PPTX Converter | Docling PPTX + slide markers | ✅ Complete |
| **4B.6** | XLSX Converter | Multi-sheet Excel → Markdown | ✅ Complete |
| **4B.7** | Text Converter | TXT/MD/JSON passthrough | ✅ Complete |

**Part 2:** See `detailed-plan-phase4-part2.md` for Chunking, Quality, Schema, Integration.

---

## Architecture (Post-Refactor)

After Strategy Pattern refactor, architecture changed to:

```
main.py → router.get_converter(format) → FormatConverter.to_markdown()
                                                ↓
                                  pipeline.ProcessingPipeline.run()
                                                ↓
                                  (sanitize → chunk → quality → embed)
```

### Key Files:
- `src/router.py` - Format → Converter + Category mapping
- `src/pipeline.py` - Unified processing pipeline
- `src/converters/` - All format converters (7 files)

---

## Prerequisites

### 1. Dependencies

```bash
# apps/ai-worker/requirements.txt
openpyxl>=3.1.2
beautifulsoup4>=4.12.3
lxml>=5.1.0
ebooklib>=0.18
pandas>=2.2.0
markdownify>=0.11.6
ftfy>=6.1.0
chardet>=5.2.0
```

### 2. ProcessorOutput Model

```python
# apps/ai-worker/src/models.py
@dataclass
class ProcessorOutput:
    markdown: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    page_count: Optional[int] = None
    slide_count: Optional[int] = None
    sheet_count: Optional[int] = None
    chapter_count: Optional[int] = None
```

---

## Part 4A: Pre-processing Layer

**Status:** ✅ Complete  
**Files:** `src/sanitizer.py`, `src/normalizer.py`

### 4A.1 Input Sanitizer
- Remove null bytes, control chars
- Normalize to NFC unicode
- Fix mojibake with `ftfy`
- Strip BOM, trailing whitespace

### 4A.2 Markdown Normalizer
- Collapse multiple blank lines
- Standardize bullets
- Fix unclosed code blocks

---

## Part 4B: Format Converters

### Base Converter Interface

```python
# src/converters/base.py
class FormatConverter(ABC):
    category: str = "document"  # "document", "presentation", "tabular"
    
    @abstractmethod
    async def to_markdown(self, file_path: str, *args) -> ProcessorOutput:
        pass
```

### Router (Format → Converter)

```python
# src/router.py
CONVERTER_MAP = {
    "pdf": PdfConverter, "docx": PdfConverter,
    "txt": TextConverter, "md": TextConverter, "json": TextConverter,
    "csv": CsvConverter, "html": HtmlConverter,
    "xlsx": XlsxConverter, "epub": EpubConverter,
    "pptx": PptxConverter,
}

CATEGORY_MAP = {
    "pdf": "document", "docx": "document", "txt": "document",
    "md": "document", "html": "document", "epub": "document",
    "pptx": "presentation",
    "xlsx": "tabular", "csv": "tabular", "json": "tabular",
}
```

---

## Part 4B.1: CSV Converter

**Status:** ✅ Complete  
**File:** `src/converters/csv_converter.py`

### Features:
- Auto-detect encoding with `chardet`
- Auto-detect delimiter with `csv.Sniffer`
- Streaming with `pandas.read_csv(chunksize=10000)`
- Small table (≤35 rows) → Markdown table
- Large table → Sentence format

---

## Part 4B.2: HTML Converter

**Status:** ✅ Complete  
**File:** `src/converters/html_converter.py`

### Features:
- Parse with `BeautifulSoup` + `lxml`
- Remove: script, style, nav, footer, aside
- Convert to markdown with `markdownify`

---

## Part 4B.3: EPUB Converter

**Status:** ✅ Complete  
**File:** `src/converters/epub_converter.py`

### Features:
- Read with `ebooklib`
- Extract `ITEM_DOCUMENT` items
- Skip toc, cover, nav items
- Extract book title as metadata

---

## Part 4B.4: PDF/DOCX Converter

**Status:** ✅ Complete  
**File:** `src/converters/pdf_converter.py`

### Features:
- Use Docling for PDF and DOCX
- OCR mode support (auto/force/never)
- Fallback to PyMuPDF
- Page count metadata

---

## Part 4B.5: PPTX Converter

**Status:** ✅ Complete  
**File:** `src/converters/pptx_converter.py`

### Features:
- Use Docling for PPTX
- Add slide markers `<!-- slide -->`
- Slide count metadata

---

## Part 4B.6: XLSX Converter

**Status:** ✅ Complete  
**File:** `src/converters/xlsx_converter.py`

### Features:
- Use `openpyxl.load_workbook(read_only=True)`
- Process all sheets
- Sheet name as H1 heading
- Small table → Markdown table
- Large table → Sentence format

---

## Part 4B.7: Text Converter

**Status:** ✅ Complete  
**File:** `src/converters/text_converter.py`

### Features:
- TXT: Read as-is
- MD: Passthrough
- JSON: Pretty format or detect category (tabular if list/dict)

---

## Test Commands

```bash
cd apps/ai-worker

# Run all converter tests
pytest tests/test_csv_processor.py tests/test_html_processor.py -v
pytest tests/test_epub_processor.py tests/test_pptx_processor.py -v
pytest tests/test_xlsx_processor.py tests/test_text_processor.py -v

# Run with coverage
pytest tests/ -v --cov=src --cov-report=term-missing
```

---

## Directory Structure (Final)

```
apps/ai-worker/src/
├── main.py                  # FastAPI endpoints
├── router.py                # Format → Converter mapping
├── pipeline.py              # Unified pipeline (sanitize→chunk→quality→embed)
├── sanitizer.py             # 4A.1 Input sanitization
├── normalizer.py            # 4A.2 Markdown normalization
├── converters/
│   ├── base.py              # FormatConverter ABC
│   ├── pdf_converter.py     # PDF/DOCX (Docling)
│   ├── text_converter.py    # TXT/MD/JSON
│   ├── csv_converter.py     # 4B.1
│   ├── html_converter.py    # 4B.2
│   ├── epub_converter.py    # 4B.3
│   ├── pptx_converter.py    # 4B.5
│   └── xlsx_converter.py    # 4B.6
├── chunkers/                # See Part 2
└── quality/                 # See Part 2
```

---

**Part 1 Status:** ✅ COMPLETE

**Next:** `detailed-plan-phase4-part2.md`
