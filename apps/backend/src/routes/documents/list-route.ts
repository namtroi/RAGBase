import { getPrismaClient } from '@/services/database.js';
import { ListQuerySchema } from '@/validators/index.js';
import { FastifyInstance } from 'fastify';

export async function listRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/documents', async (request, reply) => {
    // Use safeParse for proper error handling
    const queryResult = ListQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: queryResult.error.message,
      });
    }

    const query = queryResult.data;
    const prisma = getPrismaClient();

    const where = query.status ? { status: query.status } : {};

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        select: {
          id: true,
          filename: true,
          status: true,
          createdAt: true,
          _count: {
            select: { chunks: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.offset,
        take: query.limit,
      }),
      prisma.document.count({ where }),
    ]);

    return reply.send({
      documents: documents.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        status: doc.status,
        chunkCount: doc._count.chunks || undefined,
        createdAt: doc.createdAt.toISOString(),
      })),
      total,
    });
  });
}
