import { getPrismaClient } from '@/services/database.js';
import { EmbeddingClient } from '@/services/embedding-client.js';
import { hybridSearchService } from '@/services/hybrid-search.js';
import { qdrantHybridSearchService, shouldUseQdrantSearch } from '@/services/qdrant-hybrid-search.js';
import { QuerySchema } from '@/validators/index.js';
import { FastifyInstance } from 'fastify';

const embeddingClient = new EmbeddingClient();

export async function searchRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/query', async (request, reply) => {
    const input = QuerySchema.safeParse(request.body);

    if (!input.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: input.error.message,
      });
    }

    const { query, topK, mode, alpha } = input.data;

    // Phase 5E: Use Qdrant when configured (VECTOR_DB_PROVIDER=qdrant)
    if (shouldUseQdrantSearch()) {
      try {
        const qdrantResults = await qdrantHybridSearchService.search({
          queryText: query,
          topK,
          mode: mode as 'semantic' | 'hybrid',  // Pass user's mode selection
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
        // Fallback to pgvector if Qdrant fails
        request.log.warn({ error: error.message }, 'qdrant_search_failed_fallback');
      }
    }

    // Generate embedding for query via AI Worker (for pgvector fallback)
    let queryEmbedding: number[];
    try {
      queryEmbedding = await embeddingClient.embed(query);
    } catch (error: any) {
      return reply.status(503).send({
        error: 'EMBEDDING_SERVICE_ERROR',
        message: `Failed to generate query embedding: ${error.message}`,
      });
    }

    // Hybrid mode: use HybridSearchService with RRF
    if (mode === 'hybrid') {
      const hybridResults = await hybridSearchService.search({
        queryEmbedding,
        queryText: query,
        topK,
        alpha,
      });

      return reply.send({
        mode: 'hybrid',
        provider: 'pgvector',
        alpha,
        results: hybridResults.map(r => ({
          content: r.content,
          score: r.score,
          documentId: r.documentId,
          vectorScore: r.vectorScore,
          keywordScore: r.keywordScore,
          metadata: r.metadata,
        })),
      });
    }

    // Semantic mode (default): pure vector search using pgvector
    const prisma = getPrismaClient();
    const results = await prisma.$queryRaw<Array<{
      id: string;
      content: string;
      document_id: string;
      page: number | null;
      heading: string | null;
      quality_score: number | null;
      chunk_type: string | null;
      breadcrumbs: string[];
      similarity: number;
    }>>`
      SELECT
        c.id,
        c.content,
        c.document_id,
        c.page,
        c.heading,
        c.quality_score,
        c.chunk_type,
        c.breadcrumbs,
        1 - (c.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE d.status = 'COMPLETED' AND d.is_active = true
      ORDER BY c.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${topK}
    `;

    return reply.send({
      mode: 'semantic',
      provider: 'pgvector',
      results: results.map(r => ({
        content: r.content,
        score: Math.max(0, r.similarity),  // Ensure non-negative scores
        documentId: r.document_id,
        metadata: {
          page: r.page ?? undefined,
          heading: r.heading ?? undefined,
          qualityScore: r.quality_score ?? undefined,
          chunkType: r.chunk_type ?? undefined,
          breadcrumbs: r.breadcrumbs?.length > 0 ? r.breadcrumbs : undefined,
        },
      })),
    });
  });
}

