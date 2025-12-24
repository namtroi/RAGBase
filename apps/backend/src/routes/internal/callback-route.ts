import { FastifyInstance } from 'fastify';
import { getPrisma } from '../../services/database.js';
import { eventBus } from '../../services/event-bus.js';
import { QualityGateService } from '../../services/quality-gate-service.js';
import { CallbackSchema } from '../../validators/callback-validator.js';

const qualityGate = new QualityGateService();

export async function callbackRoute(fastify: FastifyInstance): Promise<void> {
  // Large PDF files (400+ pages) generate many chunks with embeddings
  // Each chunk has 384-dimension embedding, payload can reach 50-100MB
  fastify.post('/internal/callback', { bodyLimit: 100 * 1024 * 1024 }, async (request, reply) => {
    const parsed = CallbackSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.issues,
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

      // Emit SSE event for failed status
      eventBus.emit('document:status', { id: documentId, status: 'FAILED', error: error.code });

      return reply.send({ status: 'acknowledged', result: 'failed' });
    }

    // Handle success callback
    if (success && result && result.chunks) {
      try {
        const content = result.processedContent || '';
        console.log(`📥 Callback received for ${documentId}: Content length = ${content.length}`);
        if (!content) {
          // Should verify content presence
        }

        // Quality gate check
        const quality = qualityGate.validate(content);

        if (!quality.passed) {
          await prisma.document.update({
            where: { id: documentId },
            data: {
              status: 'FAILED',
              failReason: quality.reason,
            },
          });

          // Emit SSE event for quality gate failure
          eventBus.emit('document:status', { id: documentId, status: 'FAILED', error: quality.reason });

          return reply.send({ status: 'acknowledged', result: 'quality_failed' });
        }

        // Save chunks with pre-computed embeddings
        // Clear existing chunks first (idempotency)
        await prisma.chunk.deleteMany({
          where: { documentId }
        });

        for (const chunk of result.chunks) {
          // Convert embedding array to PostgreSQL vector string format
          const embeddingStr = `[${chunk.embedding.join(',')}]`;




          await prisma.$executeRaw`
            INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, heading, created_at)
            VALUES (
              gen_random_uuid(),
              ${documentId},
              ${chunk.content},
              ${chunk.index},
              ${embeddingStr}::vector,
              ${(chunk.metadata as any)?.charStart || 0},
              ${(chunk.metadata as any)?.charEnd || 0},
              null, 
              NOW()
            )
          `;
        }

        // Update document status & metadata
        await prisma.document.update({
          where: { id: documentId },
          data: {
            status: 'COMPLETED',
            processedContent: content,
            processingMetadata: {
              pageCount: result.pageCount,
              ocrApplied: result.ocrApplied,
              processingTimeMs: result.processingTimeMs
            }
          },
        });

        // Emit SSE event for success
        eventBus.emit('document:status', {
          id: documentId,
          status: 'COMPLETED',
          chunksCount: result.chunks.length
        });

        return reply.send({
          status: 'acknowledged',
          result: 'success',
          chunksCreated: result.chunks.length,
        });
      } catch (err: any) {
        request.log.error(err);
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

    // Fallback if chunks are missing (should not happen in normal Phase 2 flow)
    return reply.status(400).send({
      error: 'INVALID_CALLBACK',
      message: 'Callback must have result.chunks',
    });
  });
}
