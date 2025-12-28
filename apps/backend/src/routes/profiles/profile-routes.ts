/**
 * Processing Profile Routes
 * 
 * API endpoints for managing processing profiles.
 * Profiles are immutable - no edit endpoint, only duplicate.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrismaClient } from '@/services/database.js';

// ============================================================
// Schemas
// ============================================================

const ListQuerySchema = z.object({
  includeArchived: z.enum(['true', 'false']).optional().default('false'),
});

const CreateProfileSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  // Stage 1: Conversion
  conversionTableRows: z.number().int().min(1).max(1000).optional(),
  conversionTableCols: z.number().int().min(1).max(100).optional(),
  pdfOcrMode: z.enum(['auto', 'force', 'never']).optional(),
  pdfOcrLanguages: z.string().max(100).optional(),
  pdfNumThreads: z.number().int().min(1).max(16).optional(),
  pdfTableStructure: z.boolean().optional(),
  // Stage 2: Chunking
  documentChunkSize: z.number().int().min(100).max(10000).optional(),
  documentChunkOverlap: z.number().int().min(0).max(1000).optional(),
  documentHeaderLevels: z.number().int().min(1).max(6).optional(),
  presentationMinChunk: z.number().int().min(50).max(2000).optional(),
  tabularRowsPerChunk: z.number().int().min(1).max(100).optional(),
  // Stage 3: Quality
  qualityMinChars: z.number().int().min(10).max(500).optional(),
  qualityMaxChars: z.number().int().min(500).max(10000).optional(),
  qualityPenaltyPerFlag: z.number().min(0).max(1).optional(),
  autoFixEnabled: z.boolean().optional(),
  autoFixMaxPasses: z.number().int().min(0).max(10).optional(),
});

const DuplicateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

const DeleteSchema = z.object({
  confirmed: z.boolean().optional(),
});

// ============================================================
// Helpers
// ============================================================

/**
 * Generate a versioned name for duplicated profiles.
 * "Default" -> "Default v2"
 * "Default v2" -> "Default v3"
 */
function generateDuplicateName(originalName: string): string {
  const versionMatch = originalName.match(/^(.+) v(\d+)$/);
  if (versionMatch) {
    const base = versionMatch[1];
    const version = parseInt(versionMatch[2]) + 1;
    return `${base} v${version}`;
  }
  return `${originalName} v2`;
}

// ============================================================
// Routes
// ============================================================

export async function profileRoutes(fastify: FastifyInstance): Promise<void> {
  const prisma = getPrismaClient();

  /**
   * GET /api/profiles
   * List all profiles (excludes archived by default)
   */
  fastify.get('/api/profiles', async (request, reply) => {
    const queryResult = ListQuerySchema.safeParse(request.query);
    if (!queryResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: queryResult.error.message,
      });
    }

    const { includeArchived } = queryResult.data;
    const whereClause = includeArchived === 'true' ? {} : { isArchived: false };

    const profiles = await prisma.processingProfile.findMany({
      where: whereClause,
      include: {
        _count: { select: { documents: true } },
      },
      orderBy: [
        { isDefault: 'desc' },
        { isActive: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return reply.send({
      profiles: profiles.map(p => ({
        ...p,
        documentCount: p._count.documents,
        _count: undefined,
      })),
    });
  });

  /**
   * GET /api/profiles/active
   * Get the currently active profile
   */
  fastify.get('/api/profiles/active', async (_request, reply) => {
    const activeProfile = await prisma.processingProfile.findFirst({
      where: { isActive: true },
      include: {
        _count: { select: { documents: true } },
      },
    });

    if (!activeProfile) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'No active profile found',
      });
    }

    return reply.send({
      profile: {
        ...activeProfile,
        documentCount: activeProfile._count.documents,
        _count: undefined,
      },
    });
  });

  /**
   * POST /api/profiles
   * Create a new processing profile
   */
  fastify.post('/api/profiles', async (request, reply) => {
    const bodyResult = CreateProfileSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: bodyResult.error.message,
      });
    }

    const { name, description, ...settings } = bodyResult.data;

    // Check for unique name
    const existing = await prisma.processingProfile.findUnique({
      where: { name },
    });
    if (existing) {
      return reply.status(409).send({
        error: 'CONFLICT',
        message: `Profile with name "${name}" already exists`,
      });
    }

    const profile = await prisma.processingProfile.create({
      data: {
        name,
        description,
        isActive: false,
        isDefault: false,
        ...settings,
      },
    });

    return reply.status(201).send({ profile });
  });

  /**
   * POST /api/profiles/:id/duplicate
   * Clone a profile with optional new name
   */
  fastify.post('/api/profiles/:id/duplicate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const bodyResult = DuplicateSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: bodyResult.error.message,
      });
    }

    const source = await prisma.processingProfile.findUnique({
      where: { id },
    });

    if (!source) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Profile not found',
      });
    }

    // Generate or use provided name
    let newName = bodyResult.data.name || generateDuplicateName(source.name);

    // Ensure name is unique (keep incrementing version if needed)
    let attempts = 0;
    while (attempts < 100) {
      const existing = await prisma.processingProfile.findUnique({
        where: { name: newName },
      });
      if (!existing) break;
      newName = generateDuplicateName(newName);
      attempts++;
    }

    // Create duplicate with all settings
    const duplicate = await prisma.processingProfile.create({
      data: {
        name: newName,
        description: source.description,
        isActive: false,
        isDefault: false,
        isArchived: false,
        // Copy all settings
        conversionTableRows: source.conversionTableRows,
        conversionTableCols: source.conversionTableCols,
        pdfOcrMode: source.pdfOcrMode,
        pdfOcrLanguages: source.pdfOcrLanguages,
        pdfNumThreads: source.pdfNumThreads,
        pdfTableStructure: source.pdfTableStructure,
        documentChunkSize: source.documentChunkSize,
        documentChunkOverlap: source.documentChunkOverlap,
        documentHeaderLevels: source.documentHeaderLevels,
        presentationMinChunk: source.presentationMinChunk,
        tabularRowsPerChunk: source.tabularRowsPerChunk,
        qualityMinChars: source.qualityMinChars,
        qualityMaxChars: source.qualityMaxChars,
        qualityPenaltyPerFlag: source.qualityPenaltyPerFlag,
        autoFixEnabled: source.autoFixEnabled,
        autoFixMaxPasses: source.autoFixMaxPasses,
        embeddingModel: source.embeddingModel,
        embeddingDimension: source.embeddingDimension,
        embeddingMaxTokens: source.embeddingMaxTokens,
      },
    });

    return reply.status(201).send({ profile: duplicate });
  });

  /**
   * PUT /api/profiles/:id/activate
   * Set profile as active (deactivates all others)
   */
  fastify.put('/api/profiles/:id/activate', async (request, reply) => {
    const { id } = request.params as { id: string };

    const profile = await prisma.processingProfile.findUnique({
      where: { id },
    });

    if (!profile) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Profile not found',
      });
    }

    if (profile.isArchived) {
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: 'Cannot activate an archived profile. Unarchive it first.',
      });
    }

    // Deactivate all, then activate this one
    await prisma.$transaction([
      prisma.processingProfile.updateMany({
        data: { isActive: false },
      }),
      prisma.processingProfile.update({
        where: { id },
        data: { isActive: true },
      }),
    ]);

    const updated = await prisma.processingProfile.findUnique({
      where: { id },
    });

    return reply.send({ profile: updated });
  });

  /**
   * PUT /api/profiles/:id/archive
   * Archive a profile (hide from list)
   */
  fastify.put('/api/profiles/:id/archive', async (request, reply) => {
    const { id } = request.params as { id: string };

    const profile = await prisma.processingProfile.findUnique({
      where: { id },
    });

    if (!profile) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Profile not found',
      });
    }

    if (profile.isDefault) {
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: 'Cannot archive the default profile',
      });
    }

    if (profile.isActive) {
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: 'Cannot archive the active profile. Activate another profile first.',
      });
    }

    const updated = await prisma.processingProfile.update({
      where: { id },
      data: { isArchived: true },
    });

    return reply.send({ profile: updated });
  });

  /**
   * PUT /api/profiles/:id/unarchive
   * Restore an archived profile
   */
  fastify.put('/api/profiles/:id/unarchive', async (request, reply) => {
    const { id } = request.params as { id: string };

    const profile = await prisma.processingProfile.findUnique({
      where: { id },
    });

    if (!profile) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Profile not found',
      });
    }

    if (!profile.isArchived) {
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: 'Profile is not archived',
      });
    }

    const updated = await prisma.processingProfile.update({
      where: { id },
      data: { isArchived: false },
    });

    return reply.send({ profile: updated });
  });

  /**
   * DELETE /api/profiles/:id
   * Delete a profile (must be archived, requires confirmation if has documents)
   */
  fastify.delete('/api/profiles/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    // Support confirmed from query param (frontend) OR body (legacy/tests)
    const query = request.query as { confirmed?: string };
    const bodyResult = DeleteSchema.safeParse(request.body);
    const confirmedFromQuery = query.confirmed === 'true';
    const confirmedFromBody = bodyResult.success ? bodyResult.data.confirmed : false;
    const confirmed = confirmedFromQuery || confirmedFromBody;

    const profile = await prisma.processingProfile.findUnique({
      where: { id },
      include: {
        _count: { select: { documents: true } },
        documents: {
          select: {
            _count: { select: { chunks: true } },
          },
        },
      },
    });

    if (!profile) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Profile not found',
      });
    }

    // Block default profile deletion
    if (profile.isDefault) {
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: 'Cannot delete the default profile',
      });
    }

    // Block active profile deletion
    if (profile.isActive) {
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: 'Cannot delete the active profile. Activate another profile first.',
      });
    }

    // Must be archived before deletion
    if (!profile.isArchived) {
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: 'Profile must be archived before deletion. Archive it first.',
      });
    }

    // Calculate total chunks
    const totalChunks = profile.documents.reduce(
      (sum, doc) => sum + doc._count.chunks,
      0
    );

    // Require confirmation if has documents
    if (!confirmed && profile._count.documents > 0) {
      return reply.send({
        requireConfirmation: true,
        documentCount: profile._count.documents,
        chunkCount: totalChunks,
        message: `This will permanently delete ${profile._count.documents} documents and ${totalChunks} chunks. Are you sure?`,
      });
    }

    // Perform deletion (cascade will handle documents/chunks due to onDelete: SetNull)
    // But we want to also delete the linked documents - need to do it manually
    await prisma.$transaction(async (tx) => {
      // First delete all chunks for documents linked to this profile
      await tx.$executeRaw`
        DELETE FROM chunks WHERE document_id IN (
          SELECT id FROM documents WHERE processing_profile_id = ${id}
        )
      `;
      // Delete documents linked to this profile
      await tx.document.deleteMany({
        where: { processingProfileId: id },
      });
      // Delete the profile
      await tx.processingProfile.delete({
        where: { id },
      });
    });

    return reply.send({
      success: true,
      deletedDocuments: profile._count.documents,
      deletedChunks: totalChunks,
    });
  });
}
