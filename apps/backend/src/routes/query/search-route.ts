import { qdrantHybridSearchService, shouldUseQdrantSearch } from '@/services/qdrant-hybrid-search.js';
import { QuerySchema } from '@/validators/index.js';
import { FastifyInstance } from 'fastify';

export async function searchRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/query', async (request, reply) => {
    const input = QuerySchema.safeParse(request.body);

    if (!input.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: input.error.message,
      });
    }

    const { query, topK, mode } = input.data;

    // Phase 5: Qdrant-only search (mandatory)
    if (!shouldUseQdrantSearch()) {
      return reply.status(503).send({
        error: 'SEARCH_UNAVAILABLE',
        message: 'Qdrant is not configured. Please set QDRANT_URL and QDRANT_API_KEY.',
      });
    }

    try {
      const qdrantResults = await qdrantHybridSearchService.search({
        queryText: query,
        topK,
        mode: mode as 'semantic' | 'hybrid',
      });

      return reply.send({
        mode: mode === 'hybrid' ? 'qdrant_hybrid' : 'qdrant_semantic',
        provider: 'qdrant',
        results: qdrantResults.map(r => ({
          content: r.content,
          score: r.score,
          documentId: r.documentId,
          metadata: r.metadata,
        })),
      });
    } catch (error: any) {
      request.log.error({ error: error.message }, 'qdrant_search_failed');
      return reply.status(503).send({
        error: 'SEARCH_ERROR',
        message: `Qdrant search failed: ${error.message}`,
      });
    }
  });
}
