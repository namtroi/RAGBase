import { createHash } from 'crypto';

export class HashService {
  /**
   * Generate MD5 hash from buffer
   */
  static md5(buffer: Buffer): string {
    return createHash('md5').update(buffer).digest('hex');
  }

  /**
   * Generate MD5 hash from file buffer (async wrapper)
   */
  static async md5FromFile(buffer: Buffer): Promise<string> {
    return HashService.md5(buffer);
  }

  /**
   * Check if hash exists in set of existing hashes
   */
  static isDuplicate(hash: string, existingHashes: Set<string>): boolean {
    return existingHashes.has(hash);
  }
}
