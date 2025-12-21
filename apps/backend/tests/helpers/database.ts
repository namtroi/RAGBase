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
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';

let prismaInstance: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    
    prismaInstance = new PrismaClient({
      adapter,
    }) as unknown as PrismaClient;
  }
  return prismaInstance;
}

export async function cleanDatabase(): Promise<void> {
  const prisma = getPrisma();
  // Order matters due to FK constraints
  // Note: chunk model uses pgvector (Unsupported), so we must use raw SQL for deletions
  await prisma.$executeRaw`DELETE FROM chunks`;
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
  const id = data.id || crypto.randomUUID();
  const content = data.content || 'Test chunk content';
  const chunkIndex = data.chunkIndex ?? 0;
  const charStart = data.charStart ?? 0;
  const charEnd = data.charEnd ?? 100;
  const heading = data.heading || null;

  await prisma.$executeRaw`
    INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, page, heading, created_at)
    VALUES (
      ${id}::uuid,
      ${documentId}::uuid,
      ${content},
      ${chunkIndex},
      array_fill(0, ARRAY[384])::vector,
      ${charStart},
      ${charEnd},
      ${data.page || null},
      ${heading},
      NOW()
    )
  `;

  // Return a mock object that looks like the chunk since we can't easily fetch it back without pgvector issues if we select everything
  return {
    id,
    documentId,
    content,
    chunkIndex,
    charStart,
    charEnd,
    heading,
  };
}
