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
 * Mock the fastembed module
 */
export function mockFastEmbed() {
  vi.mock('fastembed', () => ({
    FlagEmbedding: {
      init: vi.fn(async () => ({
        queryEmbed: vi.fn(async (text: string) => {
          return new Float32Array(mockEmbedding(text));
        }),
        embed: vi.fn(function* (texts: string[], batchSize: number = 256) {
          // Generator that yields batches
          for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            yield batch.map(t => new Float32Array(mockEmbedding(t)));
          }
        }),
      })),
    },
    EmbeddingModel: {
      AllMiniLML6V2: 'sentence-transformers/all-MiniLM-L6-v2',
      BGEBaseEN: 'BAAI/bge-base-en',
      BGEBaseENV15: 'BAAI/bge-base-en-v1.5',
      BGESmallEN: 'BAAI/bge-small-en',
      BGESmallENV15: 'BAAI/bge-small-en-v1.5',
      BGESmallZH: 'BAAI/bge-base-zh-v1.5',
      MLE5Large: 'intfloat/multilingual-e5-large',
    },
  }));
}

// Alias for backward compatibility
export const mockTransformers = mockFastEmbed;

// Pre-computed embeddings for common test phrases
export const KNOWN_EMBEDDINGS = {
  'hello world': mockEmbedding('hello world'),
  'test document content': mockEmbedding('test document content'),
  'search query': mockEmbedding('search query'),
};

/**
 * Mock the EmbeddingClient (calls AI Worker for embeddings)
 * This replaces the HTTP call with deterministic mock embeddings
 */
export function mockEmbeddingClient() {
  vi.mock('@/services/embedding-client.js', () => ({
    EmbeddingClient: vi.fn().mockImplementation(() => ({
      embed: vi.fn(async (text: string) => mockEmbedding(text)),
      embedBatch: vi.fn(async (texts: string[]) => texts.map(mockEmbedding)),
    })),
  }));
}
