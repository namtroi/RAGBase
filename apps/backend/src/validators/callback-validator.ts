import { z } from 'zod';

const ProcessingResultSchema = z.object({
  markdown: z.string(),
  pageCount: z.number().int().positive(),
  ocrApplied: z.boolean(),
  processingTimeMs: z.number().positive(),
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
