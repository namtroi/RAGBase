# Processing Settings

Complete reference for all processing configuration. Organized by data flow stages.

---

## Overview

Settings are divided into 3 categories:
1. **Profile Settings** - Configurable per-document via Processing Profile UI
2. **Environment Variables** - Infrastructure settings in `.env`
3. **Fixed Settings** - Hardcoded, not user-configurable

---

## Stage 1: Upload & Validation

### Max File Size

| Source | Setting | Default |
|--------|---------|---------|
| Profile | `maxFileSizeMb` | 50 |

**What:** Maximum upload file size in MB.
**Why:** Prevent memory issues and processing timeouts.
**How:** Increase for large documents. Reduce for resource-constrained servers.

---

## Stage 2: PDF Conversion (Docling)

### OCR Mode

| Source | Setting | Default |
|--------|---------|---------|
| Profile | `pdfOcrMode` | `auto` |

**What:** Text extraction method for PDFs.
**Why:** Scanned PDFs need OCR. Digital PDFs don't.
**How:**
- `auto` - Enable OCR (Docling auto-detects when needed)
- `force` - Always OCR (best for scanned docs)
- `never` - Never OCR (fastest, text-only PDFs)

### OCR Languages

| Source | Setting | Default |
|--------|---------|---------|
| Profile | `pdfOcrLanguages` | `en` |

**What:** Language codes for OCR engine.
**Why:** Accuracy depends on correct language model.
**How:** Use ISO codes comma-separated: `en,vi,ja`

### PDF Threads

| Source | Setting | Default |
|--------|---------|---------|
| Profile | `pdfNumThreads` | 4 |

**What:** CPU threads per PDF conversion.
**Why:** More threads = faster single-PDF processing.
**How:** Set to CPU core count. Too high = CPU contention.

### Table Detection

| Source | Setting | Default |
|--------|---------|---------|
| Profile | `pdfTableStructure` | false |

**What:** Identify table structures in PDFs.
**Why:** Better Markdown table formatting.
**How:** Enable for docs with tables. Disable for faster processing.

### Table Dimensions

| Source | Setting | Default |
|--------|---------|---------|
| Profile | `conversionTableRows` | 35 |
| Profile | `conversionTableCols` | 20 |

**What:** Maximum rows/columns to preserve from tables.
**Why:** Large tables overflow LLM context windows.
**How:** Reduce for very large tables. Increase if tables are truncated.

### Accelerator Device

| Source | Setting | Value | Location |
|--------|---------|-------|----------|
| Fixed | `AcceleratorDevice` | CPU | pdf_converter.py |

**What:** Processing device for Docling.
**Why:** GPU mode causes meta tensor errors with current model.
**How:** Cannot change. Always CPU.

---

## Stage 3: Other Format Conversion

### HTML Cleanup Tags

| Source | Setting | Location |
|--------|---------|----------|
| Fixed | `REMOVE_TAGS` | html_converter.py |

**Value:** `nav, footer, aside, script, style, noscript, iframe, svg, header`
**Why:** Standard noise removal for web content.

### EPUB Skip Items

| Source | Setting | Location |
|--------|---------|----------|
| Fixed | `SKIP_ITEMS` | epub_converter.py |

**Value:** `toc, nav, cover, ncx, copyright, title, license`
**Why:** Standard non-content files in EPUB structure.

---

## Stage 4: Chunking

### Document Chunking

| Source | Setting | Default |
|--------|---------|---------|
| Profile | `documentChunkSize` | 1000 |
| Profile | `documentChunkOverlap` | 100 |
| Profile | `documentHeaderLevels` | 3 |

**What:** Size, overlap, and header split depth for document formats.
**Why:** Chunk size affects retrieval quality. Overlap preserves context.
**How:**
- Smaller chunks = more precise retrieval, more API calls
- Larger chunks = better context, may exceed token limits
- H1-H3 headers = split at major sections

### Presentation Chunking

| Source | Setting | Default |
|--------|---------|---------|
| Profile | `presentationMinChunk` | 200 |

**What:** Minimum characters per slide chunk.
**Why:** Merge small slides to avoid fragmented content.

### Tabular Chunking

| Source | Setting | Default |
|--------|---------|---------|
| Profile | `tabularRowsPerChunk` | 20 |

**What:** Rows per chunk for CSV/Excel files.
**Why:** Balance between context and token limits.

---

## Stage 5: Quality Analysis

### Chunk Size Limits

| Source | Setting | Default |
|--------|---------|---------|
| Profile | `qualityMinChars` | 50 |
| Profile | `qualityMaxChars` | 2000 |

**What:** Min/max characters for quality scoring.
**Why:** Chunks too short = low recall. Too long = exceed LLM context.

### Quality Scoring

| Source | Setting | Default |
|--------|---------|---------|
| Profile | `qualityPenaltyPerFlag` | 0.15 |

**What:** Score penalty per quality flag.
**Why:** Lower scores = lower search ranking.

### Auto-Fix

| Source | Setting | Default |
|--------|---------|---------|
| Profile | `autoFixEnabled` | true |
| Profile | `autoFixMaxPasses` | 2 |

**What:** Automatic chunk quality improvement passes.
**Why:** Merge short chunks, split long chunks automatically.

---

## Stage 6: Embedding

### Model Settings (Display Only)

| Source | Setting | Default | Editable |
|--------|---------|---------|----------|
| Profile | `embeddingModel` | BAAI/bge-small-en-v1.5 | No |
| Profile | `embeddingDimension` | 384 | No |
| Profile | `embeddingMaxTokens` | 512 | No |

**What:** Embedding model configuration.
**Why:** Cannot change per-profile - would break vector compatibility.
**How:** Displayed in UI for reference. Change requires database reset.

### Normalize Embeddings

| Source | Setting | Value | Location |
|--------|---------|-------|----------|
| Fixed | `normalize_embeddings` | True | embedder.py |

**Why:** Required for cosine similarity search. Always enabled.

---

## Infrastructure Settings (Environment Variables)

### Queue Concurrency

| Source | Setting | Default |
|--------|---------|---------|
| Env | `PDF_CONCURRENCY` | 1 |

**What:** Parallel document processing jobs.
**Why:** Controls BullMQ worker concurrency.
**How:** Set in `.env`. Match CPU cores. Requires restart.

```env
PDF_CONCURRENCY=3
```

### AI Worker Settings

| Source | Setting | Default | Location |
|--------|---------|---------|----------|
| Env | `MAX_WORKERS` | 4 | config.py |

**What:** AI worker internal processing semaphore.
**Why:** Limits concurrent conversions within worker.

---

## Fixed Settings Reference

| Setting | Value | Location | Reason |
|---------|-------|----------|--------|
| `AcceleratorDevice` | CPU | pdf_converter.py | GPU causes tensor errors |
| `REMOVE_TAGS` | nav,footer,aside... | html_converter.py | Standard noise |
| `SKIP_ITEMS` | toc,nav,cover... | epub_converter.py | Non-content files |
| `max_iterations` | 10 | normalizer.py | Empty section removal limit |
| `normalize_embeddings` | True | embedder.py | Required for cosine search |
| `OVERSIZED_CHUNK_THRESHOLD` | 1500 | metrics.py | Reporting only |

---

## Quick Reference

### What to tune for faster processing:
- Increase `PDF_CONCURRENCY` (env)
- Increase `pdfNumThreads` (profile)
- Set `pdfOcrMode: never` if no scanned docs

### What to tune for better retrieval:
- Reduce `documentChunkSize` for precision
- Increase `documentChunkOverlap` for context
- Enable `autoFixEnabled` for quality

### What requires restart:
- `PDF_CONCURRENCY` - env var
- `embeddingModel` - requires DB reset
