import { EmbeddingService } from '@/services';
import { getPrismaClient } from '@/services/database';
import { QuerySchema } from '@/validators';
import { FastifyInstance } from 'fastify';

const embeddingService = new EmbeddingService();

export async function searchRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/query', async (request, reply) => {
    const input = QuerySchema.safeParse(request.body);

    if (!input.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: input.error.message,
      });
    }

    const { query, topK } = input.data;

    // Generate embedding for query with error handling
    let queryEmbedding: number[];
    try {
      queryEmbedding = await embeddingService.embed(query);
    } catch (error: any) {
      return reply.status(503).send({
        error: 'EMBEDDING_SERVICE_ERROR',
        message: `Failed to generate query embedding: ${error.message}`,
      });
    }

    // Search using pgvector (let Prisma handle parameter binding)
    const prisma = getPrismaClient();
    const results = await prisma.$queryRaw<Array<{
      id: string;
      content: string;
      document_id: string;
      char_start: number;
      char_end: number;
      page: number | null;
      heading: string | null;
      similarity: number;
    }>>`
      SELECT
        c.id,
        c.content,
        c.document_id,
        c.char_start,
        c.char_end,
        c.page,
        c.heading,
        1 - (c.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
      FROM chunks c
      ORDER BY c.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${topK}
    `;

    return reply.send({
      results: results.map(r => ({
        content: r.content,
        score: r.similarity,
        documentId: r.document_id,
        metadata: {
          charStart: r.char_start,
          charEnd: r.char_end,
          page: r.page || undefined,
          heading: r.heading || undefined,
        },
      })),
    });
  });
}
