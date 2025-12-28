/**
 * Shared configuration for profile field labels and tooltips.
 * Used by both ProfileCard (view) and ProfileFormDialog (create/edit).
 */

export interface FieldConfig {
    label: string;
    tooltip: string;
}

// ============================================================
// Conversion Settings
// ============================================================

export const CONVERSION_FIELDS = {
    pdfConverter: {
        label: 'PDF Converter',
        tooltip: 'What: Library for PDF conversion. Why: Trade-off between speed and quality. How: PyMuPDF4LLM is 40x faster but weak on tables. Docling is slower but better for complex PDFs.',
    },
    pdfOcrMode: {
        label: 'OCR Mode',
        tooltip: 'What: Text extraction method for Docling. Why: Scanned PDFs need OCR. How: auto (detect), force (always OCR), never (text only). Only applies when using Docling.',
    },
    pdfOcrLanguages: {
        label: 'OCR Languages',
        tooltip: "What: Language codes for OCR. Why: Accuracy depends on language model. How: Use ISO codes like 'en', 'vi', 'ja'. Only applies when using Docling.",
    },
    conversionTableRows: {
        label: 'Table Max Rows',
        tooltip: 'What: Max rows before table becomes sentences. Why: Large tables break Markdown formatting. How: Tables exceeding this use sentence serialization for XLSX/CSV.',
    },
    conversionTableCols: {
        label: 'Table Max Cols',
        tooltip: 'What: Max columns before table becomes sentences. Why: Wide tables are hard to read. How: Tables exceeding this use sentence serialization for XLSX/CSV.',
    },
    maxFileSizeMb: {
        label: 'Max File Size',
        tooltip: 'What: Maximum upload size. Why: Prevents memory issues. How: Increase for large files.',
    },
} as const;

// ============================================================
// Chunking Settings
// ============================================================

export const CHUNKING_FIELDS = {
    documentChunkSize: {
        label: 'Chunk Size',
        tooltip: 'What: Target characters per chunk. Why: Affects search precision. How: Smaller = precise, larger = more context. 500-2000 typical.',
    },
    documentChunkOverlap: {
        label: 'Overlap',
        tooltip: 'What: Shared characters between chunks. Why: Prevents cutting sentences. How: 10-20% of chunk size recommended.',
    },
    documentHeaderLevels: {
        label: 'Header Levels',
        tooltip: 'What: Which header levels create chunk boundaries. Why: Preserves document structure. How: H1-H3 for most docs.',
    },
    presentationMinChunk: {
        label: 'Presentation Min',
        tooltip: 'What: Minimum content for PPTX slides. Why: Avoid tiny chunks from sparse slides. How: 100-300 chars typical.',
    },
    tabularRowsPerChunk: {
        label: 'Tabular Rows',
        tooltip: 'What: Spreadsheet rows per chunk. Why: Group related data together. How: 10-30 rows typical.',
    },
} as const;

// ============================================================
// Quality Settings
// ============================================================

export const QUALITY_FIELDS = {
    qualityMinChars: {
        label: 'Min Chars',
        tooltip: 'What: Minimum allowed chunk size. Why: Filter out noise/fragments. How: 30-100 chars, lower for dense content.',
    },
    qualityMaxChars: {
        label: 'Max Chars',
        tooltip: 'What: Maximum allowed chunk size. Why: Prevent context overflow. How: 1500-3000 chars based on LLM.',
    },
    qualityPenaltyPerFlag: {
        label: 'Penalty/Flag',
        tooltip: 'What: Score deduction per quality issue. Why: Controls quality strictness. How: 0.1-0.2 typical, higher = stricter.',
    },
    autoFixEnabled: {
        label: 'Auto-Fix',
        tooltip: 'What: Automatically improve low-quality chunks. Why: Better retrieval results. How: Enable for most cases.',
    },
    autoFixMaxPasses: {
        label: 'Max Passes',
        tooltip: 'What: Max auto-fix retry attempts. Why: Diminishing returns after 2-3. How: 1-3 passes recommended.',
    },
} as const;

// ============================================================
// Embedding Settings (locked)
// ============================================================

export const EMBEDDING_FIELDS = {
    embeddingModel: {
        label: 'Model',
        tooltip: 'What: Vector embedding model. Why: Determines search quality. How: Fixed in code, contact admin to change.',
    },
    embeddingDimension: {
        label: 'Dimensions',
        tooltip: 'What: Vector size (dimensions). Why: Higher = more precise but slower. How: Model-dependent, typically 384-1536.',
    },
    embeddingMaxTokens: {
        label: 'Max Tokens',
        tooltip: 'What: Max tokens per embedding. Why: Chunks longer than this are truncated. How: Model limit, typically 512.',
    },
} as const;

// Convenience export for all fields
export const PROFILE_FIELDS = {
    ...CONVERSION_FIELDS,
    ...CHUNKING_FIELDS,
    ...QUALITY_FIELDS,
    ...EMBEDDING_FIELDS,
} as const;
