import { getPrisma } from '@tests/helpers/database.js';
import { describe, expect, it } from 'vitest';

describe('Direct Prisma Import Test', () => {
  it('should import Prisma with database helper', () => {
    const prisma = getPrisma();
    expect(prisma).toBeDefined();
  });
});
