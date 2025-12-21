import { FastifyInstance } from 'fastify';
import { ChunkerService } from '../../services/chunker-service.js';
import { getPrisma } from '../../services/database.js';
import { EmbeddingService } from '../../services/embedding-service.js';
import { QualityGateService } from '../../services/quality-gate-service.js';
import { CallbackSchema } from '../../validators/callback-validator.js';

const chunker = new ChunkerService({ chunkSize: 1000, chunkOverlap: 200 });
const qualityGate = new QualityGateService();
const embedder = new EmbeddingService();

export async function callbackRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/internal/callback', async (request, reply) => {
    const parsed = CallbackSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.message,
      });
    }

    const { documentId, success, result, error } = parsed.data;
    const prisma = getPrisma();

    // Check document exists
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Document not found',
      });
    }

    // Handle failure callback
    if (!success && error) {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'FAILED',
          failReason: error.code,
        },
      });

      return reply.send({ status: 'acknowledged', result: 'failed' });
    }

    // Handle success callback
    if (success && result) {
      try {
        // Quality gate check
        const quality = qualityGate.validate(result.markdown);

        if (!quality.passed) {
          await prisma.document.update({
            where: { id: documentId },
            data: {
              status: 'FAILED',
              failReason: quality.reason,
            },
          });

          return reply.send({ status: 'acknowledged', result: 'quality_failed' });
        }

        // Chunk the markdown
        const { chunks } = await chunker.chunk(result.markdown);

        if (chunks.length === 0) {
          await prisma.document.update({
            where: { id: documentId },
            data: {
              status: 'FAILED',
              failReason: 'NO_CONTENT',
            },
          });

          return reply.send({ status: 'acknowledged', result: 'no_content' });
        }

        // Generate embeddings
        const embeddings = await embedder.embedBatch(chunks.map(c => c.content));

        // Save chunks with embeddings
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embedding = embeddings[i];
          // Convert embedding array to PostgreSQL vector string format
          const embeddingStr = `[${embedding.join(',')}]`;

          await prisma.$executeRaw`
            INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, heading, created_at)
            VALUES (
              gen_random_uuid(),
              ${documentId},
              ${chunk.content},
              ${chunk.index},
              ${embeddingStr}::vector,
              ${chunk.metadata.charStart},
              ${chunk.metadata.charEnd},
              ${chunk.metadata.heading || null},
              NOW()
            )
          `;
        }

        // Update document status
        await prisma.document.update({
          where: { id: documentId },
          data: { status: 'COMPLETED' },
        });

        return reply.send({
          status: 'acknowledged',
          result: 'success',
          chunksCreated: chunks.length,
        });
      } catch (err: any) {
        await prisma.document.update({
          where: { id: documentId },
          data: {
            status: 'FAILED',
            failReason: `PROCESSING_ERROR: ${err.message}`,
          },
        });

        return reply.status(500).send({
          error: 'PROCESSING_ERROR',
          message: err.message,
        });
      }
    }

    return reply.status(400).send({
      error: 'INVALID_CALLBACK',
      message: 'Callback must have either result or error',
    });
  });
}
