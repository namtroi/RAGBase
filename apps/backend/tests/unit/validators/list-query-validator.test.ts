import { ListQuerySchema } from '@/validators/list-query-validator.js';
import { describe, expect, it } from 'vitest';

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

  describe('isActive filter', () => {
    it('should accept boolean true', () => {
      const result = ListQuerySchema.parse({ isActive: true });
      expect(result.isActive).toBe(true);
    });

    it('should accept boolean false', () => {
      const result = ListQuerySchema.parse({ isActive: false });
      expect(result.isActive).toBe(false);
    });

    it('should coerce string "true" to boolean', () => {
      const result = ListQuerySchema.parse({ isActive: 'true' });
      expect(result.isActive).toBe(true);
    });

    it('should coerce string "false" to boolean', () => {
      const result = ListQuerySchema.parse({ isActive: 'false' });
      expect(result.isActive).toBe(false);
    });

    it('should allow omitting isActive (optional)', () => {
      const result = ListQuerySchema.parse({});
      expect(result.isActive).toBeUndefined();
    });
  });

  describe('connectionState filter', () => {
    it('should accept STANDALONE', () => {
      const result = ListQuerySchema.parse({ connectionState: 'STANDALONE' });
      expect(result.connectionState).toBe('STANDALONE');
    });

    it('should accept LINKED', () => {
      const result = ListQuerySchema.parse({ connectionState: 'LINKED' });
      expect(result.connectionState).toBe('LINKED');
    });

    it('should reject invalid connectionState', () => {
      expect(() => ListQuerySchema.parse({ connectionState: 'INVALID' })).toThrow();
    });
  });

  describe('sourceType filter', () => {
    it('should accept MANUAL', () => {
      const result = ListQuerySchema.parse({ sourceType: 'MANUAL' });
      expect(result.sourceType).toBe('MANUAL');
    });

    it('should accept DRIVE', () => {
      const result = ListQuerySchema.parse({ sourceType: 'DRIVE' });
      expect(result.sourceType).toBe('DRIVE');
    });

    it('should reject invalid sourceType', () => {
      expect(() => ListQuerySchema.parse({ sourceType: 'INVALID' })).toThrow();
    });
  });

  describe('search', () => {
    it('should accept valid search string', () => {
      const result = ListQuerySchema.parse({ search: 'invoice' });
      expect(result.search).toBe('invoice');
    });

    it('should reject search string over 100 chars', () => {
      const longSearch = 'a'.repeat(101);
      expect(() => ListQuerySchema.parse({ search: longSearch })).toThrow();
    });

    it('should allow omitting search (optional)', () => {
      const result = ListQuerySchema.parse({});
      expect(result.search).toBeUndefined();
    });
  });

  describe('sorting', () => {
    it('should default sortBy to createdAt', () => {
      const result = ListQuerySchema.parse({});
      expect(result.sortBy).toBe('createdAt');
    });

    it('should default sortOrder to desc', () => {
      const result = ListQuerySchema.parse({});
      expect(result.sortOrder).toBe('desc');
    });

    it('should accept sortBy=filename', () => {
      const result = ListQuerySchema.parse({ sortBy: 'filename' });
      expect(result.sortBy).toBe('filename');
    });

    it('should accept sortBy=fileSize', () => {
      const result = ListQuerySchema.parse({ sortBy: 'fileSize' });
      expect(result.sortBy).toBe('fileSize');
    });

    it('should accept sortOrder=asc', () => {
      const result = ListQuerySchema.parse({ sortOrder: 'asc' });
      expect(result.sortOrder).toBe('asc');
    });

    it('should reject invalid sortBy', () => {
      expect(() => ListQuerySchema.parse({ sortBy: 'invalid' })).toThrow();
    });

    it('should reject invalid sortOrder', () => {
      expect(() => ListQuerySchema.parse({ sortOrder: 'random' })).toThrow();
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
