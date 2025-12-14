/**
 * Integration Test Helper - Prisma Database
 * 
 * ⚠️ NOTE: IDE shows TypeScript errors for '@prisma/client' import - this is EXPECTED and SAFE
 * 
 * Why the error occurs:
 * - This file is in tests/ directory (root workspace)
 * - '@prisma/client' is installed in apps/backend/node_modules (backend workspace)
 * - TypeScript in tests/ can't see apps/backend/node_modules
 * 
 * Why it's safe:
 * - This file is excluded from TypeScript compilation (see tests/tsconfig.json)
 * - File is not imported by any tests yet (prepared for Phase 04)
 * - Will work correctly at runtime when Vitest runs from apps/backend/
 * 
 * When to fix:
 * - Phase 04: Integration Tests implementation
 * - At that point, this file will be imported and work correctly
 * 
 * @see docs/TYPESCRIPT_PATH_FIX.md for full explanation
 */
import { PrismaClient } from '@prisma/client';

let prismaInstance: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }
  return prismaInstance;
}

export async function cleanDatabase(): Promise<void> {
  const prisma = getPrisma();
  // Order matters due to FK constraints
  await prisma.chunk.deleteMany();
  await prisma.document.deleteMany();
}

export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}

// Seed helpers for integration tests
export async function seedDocument(data: Partial<any>) {
  const prisma = getPrisma();
  return prisma.document.create({
    data: {
      filename: 'test.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      format: 'pdf',
      lane: 'heavy',
      status: 'PENDING',
      filePath: '/tmp/test.pdf',
      md5Hash: 'abc123',
      ...data,
    } as any,
  });
}

export async function seedChunk(documentId: string, data: Partial<any> = {}) {
  const prisma = getPrisma();
  return prisma.chunk.create({
    data: {
      documentId,
      content: 'Test chunk content',
      chunkIndex: 0,
      charStart: 0,
      charEnd: 100,
      ...data,
    } as any,
  });
}
