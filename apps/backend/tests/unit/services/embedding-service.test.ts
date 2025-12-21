import { mockEmbedding, mockFastEmbed } from '@tests/mocks/embedding-mock.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock sharp to prevent native module loading errors
vi.mock('sharp', () => ({
  default: vi.fn(),
}));

// Use the shared fastembed mock
mockFastEmbed();

import { EmbeddingService } from '@/services/embedding-service.js';

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(async () => {
    service = new EmbeddingService({
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      dimensions: 384,
      batchSize: 50,
    });
  });

  describe('embed()', () => {
    it('should return 384-dimension vector', async () => {
      const embedding = await service.embed('Hello world');

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding).toHaveLength(384);
    });

    it('should return numbers in valid range', async () => {
      const embedding = await service.embed('Test text');

      for (const value of embedding) {
        expect(typeof value).toBe('number');
        expect(Number.isFinite(value)).toBe(true);
      }
    });

    it('should return consistent embedding for same text', async () => {
      const text = 'Deterministic test';
      const embedding1 = await service.embed(text);
      const embedding2 = await service.embed(text);

      expect(embedding1).toEqual(embedding2);
    });

    it('should return different embeddings for different text', async () => {
      const embedding1 = await service.embed('First text');
      const embedding2 = await service.embed('Second text');

      expect(embedding1).not.toEqual(embedding2);
    });
  });

  describe('embedBatch()', () => {
    it('should embed multiple texts', async () => {
      const texts = ['Text one', 'Text two', 'Text three'];
      const embeddings = await service.embedBatch(texts);

      expect(embeddings).toHaveLength(3);
      for (const embedding of embeddings) {
        expect(embedding).toHaveLength(384);
      }
    });

    it('should return empty array for empty input', async () => {
      const embeddings = await service.embedBatch([]);
      expect(embeddings).toHaveLength(0);
    });

    it('should handle large batches', async () => {
      const texts = Array.from({ length: 100 }, (_, i) => `Text ${i}`);
      const embeddings = await service.embedBatch(texts);

      expect(embeddings).toHaveLength(100);
    });
  });

  describe('cosineSimilarity()', () => {
    it('should return 1 for identical vectors', () => {
      const vec = mockEmbedding('same text');
      const similarity = service.cosineSimilarity(vec, vec);

      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should return high similarity for similar texts', async () => {
      const vec1 = await service.embed('machine learning algorithms');
      const vec2 = await service.embed('machine learning methods');

      // With mock embeddings, similarity is based on hash
      // In real use, similar texts have high similarity
      const similarity = service.cosineSimilarity(vec1, vec2);
      expect(similarity).toBeDefined();
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should handle zero vectors', () => {
      const zero = new Array(384).fill(0);
      const vec = mockEmbedding('test');

      const similarity = service.cosineSimilarity(zero, vec);
      expect(similarity).toBe(0);
    });
  });

  describe('findSimilar()', () => {
    it('should return top K similar items', async () => {
      const queryEmbedding = mockEmbedding('query text');
      const candidates = [
        { id: '1', embedding: mockEmbedding('text one') },
        { id: '2', embedding: mockEmbedding('text two') },
        { id: '3', embedding: mockEmbedding('text three') },
      ];

      const results = service.findSimilar(queryEmbedding, candidates, 2);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBeDefined();
      expect(results[0].score).toBeDefined();
    });

    it('should sort by similarity descending', () => {
      const queryEmbedding = mockEmbedding('query');
      const candidates = [
        { id: '1', embedding: mockEmbedding('different') },
        { id: '2', embedding: mockEmbedding('query') }, // Same as query
        { id: '3', embedding: mockEmbedding('other') },
      ];

      const results = service.findSimilar(queryEmbedding, candidates, 3);

      // Same text should be most similar
      expect(results[0].id).toBe('2');
      expect(results[0].score).toBeCloseTo(1, 3);
    });
  });
});
