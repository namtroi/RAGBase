import { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

describe('Direct Prisma Import Test', () => {
  it('should import Prisma with alias', () => {
    const prisma = new PrismaClient();
    expect(prisma).toBeDefined();
  });
});
