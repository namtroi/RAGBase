import { describe, it, expect } from 'vitest';
import { QuerySchema } from '@/validators/query-validator';

describe('QuerySchema', () => {
  describe('query field', () => {
    it('should accept valid query string', () => {
      const result = QuerySchema.parse({ query: 'hello world' });
      expect(result.query).toBe('hello world');
    });

    it('should trim whitespace from query', () => {
      const result = QuerySchema.parse({ query: '  trimmed  ' });
      expect(result.query).toBe('trimmed');
    });

    it('should reject empty query', () => {
      expect(() => QuerySchema.parse({ query: '' })).toThrow();
    });

    it('should reject whitespace-only query', () => {
      expect(() => QuerySchema.parse({ query: '   ' })).toThrow();
    });

    it('should reject query exceeding 1000 chars', () => {
      const longQuery = 'a'.repeat(1001);
      expect(() => QuerySchema.parse({ query: longQuery })).toThrow();
    });

    it('should accept query at exactly 1000 chars', () => {
      const maxQuery = 'a'.repeat(1000);
      const result = QuerySchema.parse({ query: maxQuery });
      expect(result.query.length).toBe(1000);
    });
  });

  describe('topK field', () => {
    it('should default topK to 5', () => {
      const result = QuerySchema.parse({ query: 'test' });
      expect(result.topK).toBe(5);
    });

    it('should accept topK between 1 and 100', () => {
      expect(QuerySchema.parse({ query: 'test', topK: 1 }).topK).toBe(1);
      expect(QuerySchema.parse({ query: 'test', topK: 50 }).topK).toBe(50);
      expect(QuerySchema.parse({ query: 'test', topK: 100 }).topK).toBe(100);
    });

    it('should reject topK below 1', () => {
      expect(() => QuerySchema.parse({ query: 'test', topK: 0 })).toThrow();
      expect(() => QuerySchema.parse({ query: 'test', topK: -1 })).toThrow();
    });

    it('should reject topK above 100', () => {
      expect(() => QuerySchema.parse({ query: 'test', topK: 101 })).toThrow();
    });

    it('should reject non-integer topK', () => {
      expect(() => QuerySchema.parse({ query: 'test', topK: 5.5 })).toThrow();
    });
  });
});
