import { z } from 'zod';

// Phase 4: Quality metadata in chunk
const ChunkMetadataSchema = z.object({
  charStart: z.number().optional(),
  charEnd: z.number().optional(),
  location: z.record(z.unknown()).optional(),
  breadcrumbs: z.array(z.string()).optional(),
  qualityScore: z.number().optional(),
  qualityFlags: z.array(z.string()).optional(),
  chunkType: z.string().optional(),
  completeness: z.string().optional(),
  hasTitle: z.boolean().optional(),
  tokenCount: z.number().optional(),
}).passthrough();

// Phase 5: Processing metrics for analytics dashboard
const MetricsSchema = z.object({
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  conversionTimeMs: z.number().int().nonnegative().optional(),
  chunkingTimeMs: z.number().int().nonnegative().optional(),
  embeddingTimeMs: z.number().int().nonnegative().optional(),
  totalTimeMs: z.number().int().nonnegative().optional(),
  rawSizeBytes: z.number().int().nonnegative().optional(),
  markdownSizeChars: z.number().int().nonnegative().optional(),
  totalChunks: z.number().int().nonnegative().optional(),
  avgChunkSize: z.number().nonnegative().optional(),
  oversizedChunks: z.number().int().nonnegative().optional(),
  avgQualityScore: z.number().min(0).max(1).optional(),
  qualityFlags: z.record(z.number()).optional(),
  totalTokens: z.number().int().nonnegative().optional(),
}).passthrough();

const ProcessingResultSchema = z.object({
  processedContent: z.string().optional(),
  chunks: z.array(z.object({
    content: z.string(),
    index: z.number(),
    embedding: z.array(z.number()), // Expect 384d
    metadata: ChunkMetadataSchema.optional()
  })).optional(),
  pageCount: z.number().int().nonnegative(),
  ocrApplied: z.boolean(),
  processingTimeMs: z.number().nonnegative(),
  // Phase 4: Format category
  formatCategory: z.enum(['document', 'presentation', 'tabular']).optional(),
  // Phase 5: Detailed processing metrics
  metrics: MetricsSchema.optional(),
});


const ProcessingErrorSchema = z.object({
  code: z.enum([
    'PASSWORD_PROTECTED',
    'CORRUPT_FILE',
    'UNSUPPORTED_FORMAT',
    'OCR_FAILED',
    'TIMEOUT',
    'INTERNAL_ERROR',
  ]),
  message: z.string(),
});

export const CallbackSchema = z.object({
  documentId: z.string().uuid(),
  success: z.boolean(),
  result: ProcessingResultSchema.optional(),
  error: ProcessingErrorSchema.optional(),
});

export type CallbackPayload = z.infer<typeof CallbackSchema>;
export type ProcessingResult = z.infer<typeof ProcessingResultSchema>;
export type ProcessingError = z.infer<typeof ProcessingErrorSchema>;
export type ProcessingMetrics = z.infer<typeof MetricsSchema>;

