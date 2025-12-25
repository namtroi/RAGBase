import { getPrismaClient } from '@/services/database.js';
import { ListQuerySchema } from '@/validators/index.js';
import { FastifyInstance } from 'fastify';

export async function listRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/documents', async (request, reply) => {
    // Validate query params
    const queryResult = ListQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: queryResult.error.message,
      });
    }

    const query = queryResult.data;
    const prisma = getPrismaClient();

    // Build dynamic where clause
    const where: Record<string, unknown> = {};

    if (query.status) {
      where.status = query.status;
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.connectionState) {
      where.connectionState = query.connectionState;
    }
    if (query.sourceType) {
      where.sourceType = query.sourceType;
    }
    if (query.search) {
      where.filename = {
        contains: query.search,
        mode: 'insensitive',
      };
    }

    // Build orderBy
    const orderBy = { [query.sortBy]: query.sortOrder };

    // Parallel queries: documents, total, and counts
    const [documents, total, countsByStatus, activeCount] = await Promise.all([
      prisma.document.findMany({
        where,
        select: {
          id: true,
          filename: true,
          status: true,
          fileSize: true,
          sourceType: true,
          isActive: true,
          connectionState: true,
          createdAt: true,
          driveWebViewLink: true,
          _count: {
            select: { chunks: true },
          },
        },
        orderBy,
        skip: query.offset,
        take: query.limit,
      }),
      prisma.document.count({ where }),
      // Count by status (for all documents, not filtered)
      prisma.document.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      // Count active documents
      prisma.document.count({ where: { isActive: true } }),
    ]);

    // Build counts object
    const statusCounts = countsByStatus.reduce((acc, item) => {
      acc[item.status] = item._count._all;
      return acc;
    }, {} as Record<string, number>);

    const totalDocs = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

    return reply.send({
      documents: documents.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        status: doc.status,
        fileSize: doc.fileSize,
        sourceType: doc.sourceType,
        isActive: doc.isActive,
        connectionState: doc.connectionState,
        chunkCount: doc._count.chunks || undefined,
        createdAt: doc.createdAt.toISOString(),
        hasProcessedContent: doc.status === 'COMPLETED',
        driveWebViewLink: doc.driveWebViewLink || undefined,
      })),
      total,
      counts: {
        total: totalDocs,
        active: activeCount,
        inactive: totalDocs - activeCount,
        failed: statusCounts['FAILED'] || 0,
        pending: statusCounts['PENDING'] || 0,
        processing: statusCounts['PROCESSING'] || 0,
        completed: statusCounts['COMPLETED'] || 0,
      },
    });
  });
}
