# Analytics Refactor Plan

## Goal

Refactor analytics for maintainable, accurate, actionable RAG pipeline metrics.

---

## UI Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Overview (All Time, All Formats)                                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │ Total Docs   │ │ Total Chunks │ │ Success Rate │ │ Format Mix   │         │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘         │
│  ┌────────────────────────────┐ ┌────────────────────────────────┐           │
│  │ Avg Processing Time / File │ │ Avg User Wait Time / File      │           │
│  │                            │ │ (Queue + Processing)           │           │
│  └────────────────────────────┘ └────────────────────────────────┘           │
├──────────────────────────────────────────────────────────────────────────────┤
│  Pipeline Stages                                    [PDF ▼] [7 Days ▼]       │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │ Stage 1: Upload / Queue                                         │        │
│  └─────────────────────────────────────────────────────────────────┘        │
│                              ↓                                               │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │ Stage 2: Conversion                                             │        │
│  └─────────────────────────────────────────────────────────────────┘        │
│                              ↓                                               │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │ Stage 3: Chunking & Quality                                     │        │
│  └─────────────────────────────────────────────────────────────────┘        │
│                              ↓                                               │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │ Stage 4: Embedding                                              │        │
│  └─────────────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Metrics Specification

### Overview (No Filters)
| Stat | Label |
|------|-------|
| Total Documents | Total Documents |
| Total Chunks | Total Chunks |
| Success Rate % | Success Rate % |
| Format Mix | Top Format (PDF 65%...) |
| Avg Processing Time / File | Avg Processing Time / File |
| Avg User Wait Time / File | Avg User Wait Time / File (Queue + Processing) |

### Pipeline Stages (Format + Period Filters)

**Stage 1**: Files Uploaded, Avg Queue Time / File  
**Stage 2**: Avg Conversion Time / File, Avg Time / Page (PDF/Doc), OCR % (PDF only)  
**Stage 3**: Total Chunks, Avg Tokens/Chunk, Rates (Fragment/NoContext/TooShort), Context Injection %  
**Stage 4**: Vectors Indexed, Avg Embedding Time / File

---

## Implementation (TDD Approach)

### Phase 1: Backend Tests First
```
1. Write tests for new calculations
2. Run tests (expect fail)
3. Implement logic
4. Run tests (expect pass)
```

#### Test Cases
- [ ] `overview.test.ts`: Success Rate calculation
- [ ] `overview.test.ts`: Format distribution aggregation
- [ ] `processing.test.ts`: OCR Usage % (PDF filter)
- [ ] `processing.test.ts`: Avg Time / Page calculation
- [ ] `quality.test.ts`: Fragment/NoContext/TooShort rates
- [ ] `quality.test.ts`: Context Injection Rate (breadcrumbs count)

### Phase 2: Backend Implementation
- [ ] Add format filter param to routes
- [ ] Implement Success Rate calculation
- [ ] Implement OCR % aggregation
- [ ] Implement rate calculations
- [ ] Implement Context Injection query
- [ ] Extract shared `getPeriodDateRange()` utility

### Phase 3: Frontend
- [ ] Add Overview section (no filters)
- [ ] Move filters to Pipeline section
- [ ] Add format dropdown
- [ ] Update stage cards layout (vertical)
- [ ] Add new metrics display

### Phase 4: Cleanup
- [ ] Remove deprecated `processingMetadata`
- [ ] Create shared constants

