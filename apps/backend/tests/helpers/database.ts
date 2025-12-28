/**
 * Integration Test Helper - Prisma Database
 * 
 * Uses the SAME Prisma instance as source code to ensure routes and tests
 * connect to the same database (testcontainers).
 * 
 * @see docs/TYPESCRIPT_PATH_FIX.md for full explanation
 */

// Re-export from source to ensure single instance
export { disconnectPrisma, getPrisma } from '@/services/database.js';

// Import for use in this file
import { getPrisma } from '@/services/database.js';

export async function cleanDatabase(): Promise<void> {
  const prisma = getPrisma();
  // Order matters due to FK constraints
  // Note: chunk model uses pgvector (Unsupported), so we must use raw SQL for deletions
  await prisma.$executeRaw`DELETE FROM chunks`;
  await prisma.processingMetrics.deleteMany();
  await prisma.document.deleteMany();
  await prisma.driveConfig.deleteMany();
  // Delete non-default profiles only (keep default for tests)
  await prisma.processingProfile.deleteMany({
    where: { isDefault: false }
  });
}

// Seed helpers for integration tests
export async function seedProcessingProfile(data: Partial<{
  name: string;
  description: string;
  isActive: boolean;
  isDefault: boolean;
  isArchived: boolean;
  pdfConverter: string;
  pdfOcrMode: string;
  pdfOcrLanguages: string;
  conversionTableRows: number;
  conversionTableCols: number;
  documentChunkSize: number;
  documentChunkOverlap: number;
  documentHeaderLevels: number;
  presentationMinChunk: number;
  tabularRowsPerChunk: number;
  qualityMinChars: number;
  qualityMaxChars: number;
  qualityPenaltyPerFlag: number;
  autoFixEnabled: boolean;
  autoFixMaxPasses: number;
}> = {}) {
  const prisma = getPrisma();
  const defaultName = `Test Profile ${Date.now()}`;
  return prisma.processingProfile.create({
    data: {
      name: data.name ?? defaultName,
      description: data.description,
      isActive: data.isActive ?? false,
      isDefault: data.isDefault ?? false,
      isArchived: data.isArchived ?? false,
      ...data,
    },
  });
}

export async function seedDocument(data: Partial<any>) {
  const prisma = getPrisma();
  return prisma.document.create({
    data: {
      filename: 'test.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      format: 'pdf',

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

/**
 * Ensure a default profile exists for tests that need it.
 * Returns the existing or newly created default profile.
 * Always ensures the default profile is active.
 */
export async function ensureDefaultProfile() {
  const prisma = getPrisma();
  return prisma.processingProfile.upsert({
    where: { name: 'Default' },
    create: {
      name: 'Default',
      description: 'System default profile',
      isActive: true,
      isDefault: true,
    },
    update: {
      isActive: true,  // Always ensure default is active for test isolation
    },
  });
}

