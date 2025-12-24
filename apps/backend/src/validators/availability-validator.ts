/**
 * Availability Validator
 * 
 * Schema validation for toggle availability endpoints.
 */

import { z } from 'zod';

// Single document toggle
export const ToggleAvailabilitySchema = z.object({
  isActive: z.boolean(),
});

export type ToggleAvailabilityInput = z.infer<typeof ToggleAvailabilitySchema>;

// Bulk toggle
export const BulkToggleAvailabilitySchema = z.object({
  documentIds: z
    .array(z.string().uuid())
    .min(1, 'At least one document ID required')
    .max(100, 'Maximum 100 documents per request'),
  isActive: z.boolean(),
});

export type BulkToggleAvailabilityInput = z.infer<typeof BulkToggleAvailabilitySchema>;

// Params schema for :id
export const DocumentIdParamsSchema = z.object({
  id: z.string().uuid(),
});

// Shared schema for bulk operations with documentIds array only
const BulkDocumentIdsSchema = z.object({
  documentIds: z
    .array(z.string().uuid())
    .min(1, 'At least one document ID required')
    .max(100, 'Maximum 100 documents per request'),
});

// Bulk delete (uses shared schema)
export const BulkDeleteSchema = BulkDocumentIdsSchema;

export type BulkDeleteInput = z.infer<typeof BulkDeleteSchema>;

// Bulk retry (uses shared schema)
export const BulkRetrySchema = BulkDocumentIdsSchema;

export type BulkRetryInput = z.infer<typeof BulkRetrySchema>;

