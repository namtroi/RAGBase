import { describe, it, expect } from 'vitest';
import { HashService } from '../../../src/services/hash-service';

describe('HashService', () => {
  describe('md5()', () => {
    it('should generate consistent MD5 hash for same input', () => {
      const buffer = Buffer.from('Hello, World!');
      const hash1 = HashService.md5(buffer);
      const hash2 = HashService.md5(buffer);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different input', () => {
      const buffer1 = Buffer.from('Hello');
      const buffer2 = Buffer.from('World');

      const hash1 = HashService.md5(buffer1);
      const hash2 = HashService.md5(buffer2);

      expect(hash1).not.toBe(hash2);
    });

    it('should return 32 character hex string', () => {
      const buffer = Buffer.from('test');
      const hash = HashService.md5(buffer);

      expect(hash).toHaveLength(32);
      expect(hash).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should generate known MD5 hash', () => {
      // Known MD5 hash of empty string
      const emptyHash = HashService.md5(Buffer.from(''));
      expect(emptyHash).toBe('d41d8cd98f00b204e9800998ecf8427e');

      // Known MD5 hash of "hello"
      const helloHash = HashService.md5(Buffer.from('hello'));
      expect(helloHash).toBe('5d41402abc4b2a76b9719d911017c592');
    });
  });

  describe('md5FromFile()', () => {
    it('should hash file buffer', async () => {
      const fileBuffer = Buffer.from('File content for testing');
      const hash = await HashService.md5FromFile(fileBuffer);

      expect(hash).toHaveLength(32);
      expect(hash).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should be deterministic for same file', async () => {
      const fileBuffer = Buffer.from('Consistent file content');

      const hash1 = await HashService.md5FromFile(fileBuffer);
      const hash2 = await HashService.md5FromFile(fileBuffer);

      expect(hash1).toBe(hash2);
    });
  });

  describe('isDuplicate()', () => {
    it('should detect duplicate hashes', () => {
      const existingHashes = new Set(['abc123', 'def456']);
      const isDupe = HashService.isDuplicate('abc123', existingHashes);

      expect(isDupe).toBe(true);
    });

    it('should return false for new hash', () => {
      const existingHashes = new Set(['abc123', 'def456']);
      const isDupe = HashService.isDuplicate('new789', existingHashes);

      expect(isDupe).toBe(false);
    });
  });
});
