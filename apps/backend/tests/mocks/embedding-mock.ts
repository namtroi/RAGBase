import { vi } from 'vitest';

/**
 * Mock embedding generator for deterministic tests
 * Uses a simple hash-based approach to generate consistent 384d vectors
 */
export function mockEmbedding(text: string): number[] {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Generate 384 deterministic values based on hash
  const embedding: number[] = [];
  for (let i = 0; i < 384; i++) {
    // Use hash + index to generate pseudo-random but deterministic values
    const seed = hash + i;
    const value = Math.sin(seed) * 0.5; // Range roughly [-0.5, 0.5]
    embedding.push(value);
  }

  return embedding;
}

/**
 * Mock the @xenova/transformers module
 */
export function mockTransformers() {
  vi.mock('@xenova/transformers', () => ({
    pipeline: vi.fn(async () => {
      return async (text: string | string[], options?: any) => {
        // Handle both single text and batch
        const texts = Array.isArray(text) ? text : [text];
        
        if (texts.length === 1) {
          // Single embedding
          return {
            data: mockEmbedding(texts[0]),
          };
        } else {
          // Batch embeddings
          return {
            data: texts.map(t => mockEmbedding(t)),
          };
        }
      };
    }),
  }));
}
