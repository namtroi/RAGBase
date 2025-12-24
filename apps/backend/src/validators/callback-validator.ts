import { z } from 'zod';

const ProcessingResultSchema = z.object({
  processedContent: z.string().optional(),
  chunks: z.array(z.object({
    content: z.string(),
    index: z.number(),
    embedding: z.array(z.number()), // Expect 384d
    metadata: z.record(z.unknown()).optional()
  })).optional(),
  pageCount: z.number().int().nonnegative(),
  ocrApplied: z.boolean(),
  processingTimeMs: z.number().nonnegative(),
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
