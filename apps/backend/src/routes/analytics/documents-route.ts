import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrismaClient } from '@/services/database.js';

const DocumentsQuerySchema = z.object({
  period: z.enum(['24h', '7d', '30d', 'all']).default('7d'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['totalTimeMs', 'avgQualityScore', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const DocumentChunksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

function getPeriodDateRange(period: string): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  
  switch (period) {
    case '24h':
      start.setHours(start.getHours() - 24);
      break;
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    case 'all':
      start.setFullYear(2000);
      break;
  }
  
  return { start, end };
}

export async function documentsRoute(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/analytics/documents
   * Returns paginated list of documents with their processing metrics.
   */
  fastify.get('/api/analytics/documents', async (request, reply) => {
    const queryResult = DocumentsQuerySchema.safeParse(request.query);
    
    if (!queryResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: queryResult.error.message,
      });
    }
    
    const { period, page, limit, sortBy, sortOrder } = queryResult.data;
    const { start, end } = getPeriodDateRange(period);
    const prisma = getPrismaClient();
    const offset = (page - 1) * limit;
    
    // Build orderBy for processingMetrics
    const orderBy: Record<string, string> = {};
    if (sortBy === 'totalTimeMs' || sortBy === 'avgQualityScore') {
      orderBy[sortBy] = sortOrder;
    }
    
    const [metrics, total] = await Promise.all([
      prisma.processingMetrics.findMany({
        where: {
          createdAt: { gte: start, lte: end },
        },
        include: {
          document: {
            select: {
              id: true,
              filename: true,
              format: true,
              fileSize: true,
              status: true,
              formatCategory: true,
              createdAt: true,
            },
          },
        },
        orderBy: sortBy === 'createdAt' 
          ? { createdAt: sortOrder }
          : Object.keys(orderBy).length > 0 
            ? orderBy 
            : { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.processingMetrics.count({
        where: {
          createdAt: { gte: start, lte: end },
        },
      }),
    ]);
    
    return reply.send({
      period,
      documents: metrics.map(m => ({
        id: m.document.id,
        filename: m.document.filename,
        format: m.document.format,
        fileSize: m.document.fileSize,
        formatCategory: m.document.formatCategory,
        status: m.document.status,
        createdAt: m.document.createdAt.toISOString(),
        metrics: {
          pageCount: m.pageCount,
          ocrApplied: m.ocrApplied,
          queueTimeMs: m.queueTimeMs,
          conversionTimeMs: m.conversionTimeMs,
          chunkingTimeMs: m.chunkingTimeMs,
          embeddingTimeMs: m.embeddingTimeMs,
          totalTimeMs: m.totalTimeMs,
          userWaitTimeMs: m.userWaitTimeMs,
          rawSizeBytes: m.rawSizeBytes,
          markdownSizeChars: m.markdownSizeChars,
          totalChunks: m.totalChunks,
          avgChunkSize: m.avgChunkSize,
          oversizedChunks: m.oversizedChunks,
          avgQualityScore: m.avgQualityScore,
          totalTokens: m.totalTokens,
        },
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
   * GET /api/analytics/documents/:id/chunks
   * Returns chunks for a specific document with quality metadata.
   */
  fastify.get<{ Params: { id: string } }>('/api/analytics/documents/:id/chunks', async (request, reply) => {
    const { id } = request.params;
    const queryResult = DocumentChunksQuerySchema.safeParse(request.query);
    
    if (!queryResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: queryResult.error.message,
      });
    }
    
    const { page, limit } = queryResult.data;
    const prisma = getPrismaClient();
    const offset = (page - 1) * limit;
    
    // Verify document exists
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, filename: true },
    });
    
    if (!document) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Document not found',
      });
    }
    
    const [chunks, total] = await Promise.all([
      prisma.chunk.findMany({
        where: { documentId: id },
        select: {
          id: true,
          chunkIndex: true,
          content: true,
          charStart: true,
          charEnd: true,
          qualityScore: true,
          qualityFlags: true,
          chunkType: true,
          completeness: true,
          hasTitle: true,
          breadcrumbs: true,
          tokenCount: true,
        },
        orderBy: { chunkIndex: 'asc' },
        skip: offset,
        take: limit,
      }),
      prisma.chunk.count({ where: { documentId: id } }),
    ]);
    
    return reply.send({
      documentId: id,
      filename: document.filename,
      chunks: chunks.map(c => ({
        id: c.id,
        index: c.chunkIndex,
        content: c.content,
        charStart: c.charStart,
        charEnd: c.charEnd,
        qualityScore: c.qualityScore,
        qualityFlags: c.qualityFlags,
        chunkType: c.chunkType,
        completeness: c.completeness,
        hasTitle: c.hasTitle,
        breadcrumbs: c.breadcrumbs,
        tokenCount: c.tokenCount,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });
}
