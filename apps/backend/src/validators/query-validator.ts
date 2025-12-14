import { z } from 'zod';

export const QuerySchema = z.object({
  query: z.string()
    .trim()
    .min(1, 'Query cannot be empty')
    .max(1000, 'Query cannot exceed 1000 characters'),
  topK: z.number()
    .int('topK must be an integer')
    .min(1, 'topK must be at least 1')
    .max(100, 'topK cannot exceed 100')
    .default(5),
});

export type QueryInput = z.infer<typeof QuerySchema>;
