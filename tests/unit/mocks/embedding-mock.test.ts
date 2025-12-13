import { describe, it, expect } from 'vitest';
import { mockEmbedding, KNOWN_EMBEDDINGS } from '@tests/mocks/embedding-mock';

describe('Embedding Mock', () => {
  it('should generate deterministic 384d vectors', () => {
    const embedding = mockEmbedding('test text');
    
    expect(embedding).toHaveLength(384);
    expect(embedding.every(n => typeof n === 'number')).toBe(true);
  });

  it('should return same vector for same input', () => {
    const embedding1 = mockEmbedding('hello world');
    const embedding2 = mockEmbedding('hello world');
    
    expect(embedding1).toEqual(embedding2);
  });

  it('should return different vectors for different inputs', () => {
    const embedding1 = mockEmbedding('hello');
    const embedding2 = mockEmbedding('world');
    
    expect(embedding1).not.toEqual(embedding2);
  });

  it('should have pre-computed known embeddings', () => {
    expect(KNOWN_EMBEDDINGS['hello world']).toHaveLength(384);
    expect(KNOWN_EMBEDDINGS['test document content']).toHaveLength(384);
    expect(KNOWN_EMBEDDINGS['search query']).toHaveLength(384);
  });
});
