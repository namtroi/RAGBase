import { z } from 'zod';

// Custom boolean coercer that properly handles 'true' and 'false' strings
const booleanFromString = z.union([
  z.boolean(),
  z.literal('true').transform(() => true),
  z.literal('false').transform(() => false),
]);

export const ListQuerySchema = z.object({
  // Existing filters
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),

  // Phase 3: New filters
  isActive: booleanFromString.optional(),
  connectionState: z.enum(['STANDALONE', 'LINKED']).optional(),
  sourceType: z.enum(['MANUAL', 'DRIVE']).optional(),

  // Search
  search: z.string().max(100).optional(),

  // Sorting
  sortBy: z.enum(['createdAt', 'filename', 'fileSize']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),

  // Pagination
  limit: z.coerce.number()
    .int()
    .min(1)
    .max(100)
    .default(20),
  offset: z.coerce.number()
    .int()
    .min(0)
    .default(0),
});

export type ListQueryInput = z.infer<typeof ListQuerySchema>;
