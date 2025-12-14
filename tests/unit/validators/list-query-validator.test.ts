import { describe, it, expect } from 'vitest';
import { ListQuerySchema } from '@/validators/list-query-validator';

describe('ListQuerySchema', () => {
  describe('status filter', () => {
    it('should accept valid status values', () => {
      const statuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] as const;
      for (const status of statuses) {
        const result = ListQuerySchema.parse({ status });
        expect(result.status).toBe(status);
      }
    });

    it('should allow omitting status (optional)', () => {
      const result = ListQuerySchema.parse({});
      expect(result.status).toBeUndefined();
    });

    it('should reject invalid status', () => {
      expect(() => ListQuerySchema.parse({ status: 'INVALID' })).toThrow();
    });
  });

  describe('pagination', () => {
    it('should default limit to 20', () => {
      const result = ListQuerySchema.parse({});
      expect(result.limit).toBe(20);
    });

    it('should default offset to 0', () => {
      const result = ListQuerySchema.parse({});
      expect(result.offset).toBe(0);
    });

    it('should coerce string limit to number', () => {
      const result = ListQuerySchema.parse({ limit: '10' });
      expect(result.limit).toBe(10);
    });

    it('should coerce string offset to number', () => {
      const result = ListQuerySchema.parse({ offset: '5' });
      expect(result.offset).toBe(5);
    });

    it('should accept limit between 1 and 100', () => {
      expect(ListQuerySchema.parse({ limit: 1 }).limit).toBe(1);
      expect(ListQuerySchema.parse({ limit: 100 }).limit).toBe(100);
    });

    it('should reject limit below 1', () => {
      expect(() => ListQuerySchema.parse({ limit: 0 })).toThrow();
    });

    it('should reject limit above 100', () => {
      expect(() => ListQuerySchema.parse({ limit: 101 })).toThrow();
    });

    it('should reject negative offset', () => {
      expect(() => ListQuerySchema.parse({ offset: -1 })).toThrow();
    });
  });
});
