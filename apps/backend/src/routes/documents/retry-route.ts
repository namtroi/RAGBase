/**
 * Retry Route
 * 
 * Endpoints to retry failed document processing.
 * Resets status to PENDING, clears fail metadata, and re-queues.
 */

import { getProcessingQueue } from '@/queue/processing-queue.js';
import { getPrismaClient } from '@/services/database.js';
import { eventBus } from '@/services/event-bus.js';
import {
    BulkRetrySchema,
    DocumentIdParamsSchema,
} from '@/validators/availability-validator.js';
import { FastifyInstance } from 'fastify';

export async function retryRoute(fastify: FastifyInstance): Promise<void> {
    /**
     * POST /api/documents/:id/retry
     * Retry a single failed document
     */
    fastify.post('/api/documents/:id/retry', async (request, reply) => {
        const prisma = getPrismaClient();

        // Validate params
        const paramsResult = DocumentIdParamsSchema.safeParse(request.params);
        if (!paramsResult.success) {
            return reply.status(400).send({
                error: 'INVALID_ID',
                message: 'Invalid document ID format',
            });
        }

        const { id } = paramsResult.data;

        // Find document
        const document = await prisma.document.findUnique({
            where: { id },
            select: { id: true, status: true, filePath: true, format: true },
        });

        if (!document) {
            return reply.status(404).send({
                error: 'NOT_FOUND',
                message: 'Document not found',
            });
        }

        // Only FAILED documents can be retried
        if (document.status !== 'FAILED') {
            return reply.status(400).send({
                error: 'INVALID_STATUS',
                message: `Cannot retry ${document.status} document. Only FAILED documents can be retried.`,
            });
        }

        // Reset document status
        await prisma.document.update({
            where: { id },
            data: {
                status: 'PENDING',
                failReason: null,
                retryCount: 0,
            },
        });

        // Re-queue for processing
        await getProcessingQueue().add('process', {
            documentId: id,
            filePath: document.filePath,
            format: document.format as any,
            config: {
                ocrMode: 'auto',
                ocrLanguages: ['en'],
            },
        });

        // Emit SSE event
        eventBus.emit('document:retry', { id });

        return reply.send({
            id,
            status: 'PENDING',
        });
    });

    /**
     * POST /api/documents/bulk/retry
     * Retry multiple failed documents
     */
    fastify.post('/api/documents/bulk/retry', async (request, reply) => {
        const prisma = getPrismaClient();

        // Validate body
        const bodyResult = BulkRetrySchema.safeParse(request.body);
        if (!bodyResult.success) {
            return reply.status(400).send({
                error: 'VALIDATION_ERROR',
                message: bodyResult.error.errors[0]?.message || 'Invalid request body',
            });
        }

        const { documentIds } = bodyResult.data;

        // Fetch all documents
        const documents = await prisma.document.findMany({
            where: { id: { in: documentIds } },
            select: { id: true, status: true, filePath: true, format: true },
        });

        // Build lookup and collect retriable docs
        const foundDocs = new Map(documents.map(d => [d.id, d]));
        const retriableIds: string[] = [];
        const docsToQueue: { id: string; filePath: string; format: string }[] = [];

        // Track failures
        const failed: { id: string; reason: string }[] = [];

        for (const docId of documentIds) {
            const doc = foundDocs.get(docId);
            if (!doc) {
                failed.push({ id: docId, reason: 'Document not found' });
            } else if (doc.status !== 'FAILED') {
                failed.push({ id: docId, reason: `Cannot retry ${doc.status} document` });
            } else {
                retriableIds.push(docId);
                docsToQueue.push({ id: doc.id, filePath: doc.filePath, format: doc.format });
            }
        }

        // Update all valid documents
        let retriedCount = 0;
        if (retriableIds.length > 0) {
            const result = await prisma.document.updateMany({
                where: { id: { in: retriableIds } },
                data: {
                    status: 'PENDING',
                    failReason: null,
                    retryCount: 0,
                },
            });
            retriedCount = result.count;

            // Queue all for processing
            const queue = getProcessingQueue();
            for (const doc of docsToQueue) {
                await queue.add('process', {
                    documentId: doc.id,
                    filePath: doc.filePath,
                    format: doc.format as any,
                    config: {
                        ocrMode: 'auto',
                        ocrLanguages: ['en'],
                    },
                });
            }
        }

        // Emit bulk completion event
        if (retriedCount > 0) {
            eventBus.emit('bulk:completed', {
                operation: 'retry',
                count: retriedCount,
            });
        }

        return reply.send({
            retried: retriedCount,
            failed,
        });
    });
}
