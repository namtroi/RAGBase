import { getPrismaClient } from '@/services/database.js';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

export async function statusRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/documents/:id', async (request, reply) => {
    const params = ParamsSchema.safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        error: 'INVALID_ID',
        message: 'Invalid document ID format',
      });
    }

    const prisma = getPrismaClient();
    const document = await prisma.document.findUnique({
      where: { id: params.data.id },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });

    if (!document) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Document not found',
      });
    }

    return reply.send({
      id: document.id,
      filename: document.filename,
      status: document.status,
      retryCount: document.retryCount,
      failReason: document.failReason || undefined,
      chunkCount: document.status === 'COMPLETED' ? document._count.chunks : undefined,
      hasProcessedContent: !!document.processedContent,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    });
  });
}
