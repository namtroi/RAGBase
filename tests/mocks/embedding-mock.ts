import { vi } from 'vitest';

/**
 * Generate deterministic 384d vector from text hash
 * Same text always produces same vector for test reproducibility
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}

export function mockEmbedding(text: string): number[] {
  const seed = hashCode(text);
  return Array.from({ length: 384 }, (_, i) =>
    Math.sin(seed + i) * 0.5
  );
}

/**
 * Create a mock embedder that returns deterministic vectors
 */
export function createMockEmbedder() {
  return {
    embed: vi.fn(async (text: string) => mockEmbedding(text)),
    embedBatch: vi.fn(async (texts: string[]) => texts.map(mockEmbedding)),
  };
}

/**
 * Mock the @xenova/transformers module
 */
export function mockTransformers() {
  vi.mock('@xenova/transformers', () => ({
    pipeline: vi.fn(async () => {
      return async (text: string, options?: { pooling?: string; normalize?: boolean }) => {
        return {
          data: new Float32Array(mockEmbedding(text)),
        };
      };
    }),
    env: {
      allowRemoteModels: true,
      allowLocalModels: true,
    },
  }));
}

// Pre-computed embeddings for common test phrases
export const KNOWN_EMBEDDINGS = {
  'hello world': mockEmbedding('hello world'),
  'test document content': mockEmbedding('test document content'),
  'search query': mockEmbedding('search query'),
};
