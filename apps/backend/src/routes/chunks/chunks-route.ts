import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrismaClient } from '@/services/database.js';

const ChunksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  documentId: z.string().uuid().optional(),
  quality: z.enum(['excellent', 'good', 'low']).optional(),
  type: z.enum(['document', 'presentation', 'tabular']).optional(),
  flags: z.string().optional(), // Comma-separated flags
  search: z.string().optional(),
  sortBy: z.enum(['index', 'tokenCount', 'qualityScore']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

type SortByField = 'index' | 'tokenCount' | 'qualityScore';
type SortOrder = 'asc' | 'desc';

function buildOrderBy(sortBy?: SortByField, sortOrder?: SortOrder) {
  if (sortBy === 'tokenCount') {
    return [{ tokenCount: sortOrder || 'desc' }];
  }
  if (sortBy === 'qualityScore') {
    return [{ qualityScore: sortOrder || 'desc' }];
  }
  // Default: by document then index
  return [{ documentId: 'asc' as const }, { chunkIndex: 'asc' as const }];
}

export async function chunksRoute(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/chunks
   * Returns paginated, filterable list of chunks.
   */
  fastify.get('/api/chunks', async (request, reply) => {
    const queryResult = ChunksQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: queryResult.error.message,
      });
    }

    const { page, limit, documentId, quality, type, flags, search, sortBy, sortOrder } = queryResult.data;
    const prisma = getPrismaClient();
    const offset = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (documentId) {
      where.documentId = documentId;
    }

    if (quality) {
      switch (quality) {
        case 'excellent':
          where.qualityScore = { gte: 0.85 };
          break;
        case 'good':
          where.qualityScore = { gte: 0.70, lt: 0.85 };
          break;
        case 'low':
          where.qualityScore = { lt: 0.70 };
          break;
      }
    }

    if (type) {
      where.chunkType = type;
    }

    if (flags) {
      const flagList = flags.split(',').map(f => f.trim());
      where.qualityFlags = { hasSome: flagList };
    }

    if (search) {
      where.content = { contains: search, mode: 'insensitive' };
    }

    const [chunks, total] = await Promise.all([
      prisma.chunk.findMany({
        where,
        select: {
          id: true,
          documentId: true,
          chunkIndex: true,
          content: true,
          qualityScore: true,
          qualityFlags: true,
          chunkType: true,
          completeness: true,
          hasTitle: true,
          tokenCount: true,
          breadcrumbs: true,
          syncStatus: true,
          document: {
            select: {
              filename: true,
              format: true,
              formatCategory: true,
            },
          },
        },
        orderBy: buildOrderBy(sortBy, sortOrder),
        skip: offset,
        take: limit,
      }),
      prisma.chunk.count({ where }),
    ]);

    return reply.send({
      chunks: chunks.map(c => ({
        id: c.id,
        documentId: c.documentId,
        filename: c.document.filename,
        format: c.document.format,
        formatCategory: c.document.formatCategory,
        index: c.chunkIndex,
        content: c.content, // Full content, no truncation
        qualityScore: c.qualityScore,
        qualityFlags: c.qualityFlags,
        chunkType: c.chunkType,
        completeness: c.completeness,
        hasTitle: c.hasTitle,
        tokenCount: c.tokenCount,
        breadcrumbs: c.breadcrumbs,
        syncStatus: c.syncStatus,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  /**
   * GET /api/chunks/:id
   * Returns full detail for a single chunk.
   */
  fastify.get<{ Params: { id: string } }>('/api/chunks/:id', async (request, reply) => {
    const { id } = request.params;
    const prisma = getPrismaClient();

    const chunk = await prisma.chunk.findUnique({
      where: { id },
      select: {
        id: true,
        documentId: true,
        chunkIndex: true,
        content: true,
        qualityScore: true,
        qualityFlags: true,
        chunkType: true,
        completeness: true,
        hasTitle: true,
        breadcrumbs: true,
        tokenCount: true,
        location: true,
        createdAt: true,
        document: {
          select: {
            id: true,
            filename: true,
            format: true,
            formatCategory: true,
          },
        },
      },
    });

    if (!chunk) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Chunk not found',
      });
    }

    return reply.send({
      id: chunk.id,
      documentId: chunk.documentId,
      document: chunk.document,
      index: chunk.chunkIndex,
      content: chunk.content,
      qualityScore: chunk.qualityScore,
      qualityFlags: chunk.qualityFlags,
      chunkType: chunk.chunkType,
      completeness: chunk.completeness,
      hasTitle: chunk.hasTitle,
      breadcrumbs: chunk.breadcrumbs,
      tokenCount: chunk.tokenCount,
      location: chunk.location,
      createdAt: chunk.createdAt.toISOString(),
    });
  });
}
