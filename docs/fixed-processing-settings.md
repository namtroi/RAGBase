# Fixed Processing Settings

Settings that are hardcoded and **not configurable** via Processing Profile.

---

## Why Fixed?

These settings are either:
1. **Too advanced** - Wrong values can break processing entirely
2. **Internal** - Implementation detail, not user-facing
3. **Hardware** - System-level, not per-document

---

## Fixed Settings List

### PDF Conversion

| Setting | Value | Location | Reason |
|---------|-------|----------|--------|
| `AcceleratorDevice` | CPU | pdf_converter.py | GPU causes meta tensor errors. Always CPU. |

### HTML Cleanup

| Setting | Value | Location | Reason |
|---------|-------|----------|--------|
| `REMOVE_TAGS` | nav, footer, aside, script, style, noscript, iframe, svg, header | html_converter.py | Standard noise removal. Wrong config = broken content. |

### EPUB Cleanup

| Setting | Value | Location | Reason |
|---------|-------|----------|--------|
| `SKIP_ITEMS` | toc, nav, cover, ncx, copyright, title, license | epub_converter.py | Standard non-content files. Keep fixed. |

### Normalizer

| Setting | Value | Location | Reason |
|---------|-------|----------|--------|
| `max_iterations` | 10 | normalizer.py | Loop limit for empty section removal. Internal safety. |

### Embedder

| Setting | Value | Location | Reason |
|---------|-------|----------|--------|
| `normalize_embeddings` | True | embedder.py | Required for cosine similarity. Always True. |

### Analytics

| Setting | Value | Location | Reason |
|---------|-------|----------|--------|
| `OVERSIZED_CHUNK_THRESHOLD` | 1500 | metrics.py | Reporting threshold only. Not processing logic. |

---

## Future Consideration

If needed later, these can be moved to "Advanced Settings" section with proper validation and warnings. Current scope: keep simple.
