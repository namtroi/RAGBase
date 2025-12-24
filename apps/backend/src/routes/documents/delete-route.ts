/**
 * Delete Route
 * 
 * Endpoints to permanently delete documents.
 * Deletes: Document record + all Chunks + file on disk.
 * Cannot delete PROCESSING documents.
 */

import { rm } from 'fs/promises';
import { eventBus } from '@/services/event-bus.js';
import { getPrismaClient } from '@/services/database.js';
import {
  BulkDeleteSchema,
  DocumentIdParamsSchema,
} from '@/validators/availability-validator.js';
import { FastifyInstance } from 'fastify';

export async function deleteRoute(fastify: FastifyInstance): Promise<void> {

  /**
   * DELETE /api/documents/:id
   * Hard delete a single document
   */
  fastify.delete('/api/documents/:id', async (request, reply) => {
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
      select: { id: true, status: true, filePath: true },
    });

    if (!document) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Document not found',
      });
    }

    // Cannot delete PROCESSING documents
    if (document.status === 'PROCESSING') {
      return reply.status(409).send({
        error: 'CONFLICT',
        message: 'Cannot delete document while processing',
      });
    }

    // Delete document (chunks auto-deleted via CASCADE)
    await prisma.document.delete({ where: { id } });

    // Delete file from disk (non-blocking)
    rm(document.filePath).catch(() => {
      // Ignore file deletion errors (file may not exist)
    });

    // Emit SSE event
    eventBus.emit('document:deleted', { id });

    return reply.send({
      id,
      deleted: true,
    });
  });

  /**
   * POST /api/documents/bulk/delete
   * Hard delete multiple documents
   * Note: Using POST instead of DELETE because DELETE with body is not well-supported
   */
  fastify.post('/api/documents/bulk/delete', async (request, reply) => {
    const prisma = getPrismaClient();

    // Validate body
    const bodyResult = BulkDeleteSchema.safeParse(request.body);
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
      select: { id: true, status: true, filePath: true },
    });

    // Build sets for quick lookup
    const foundDocs = new Map(documents.map(d => [d.id, d]));
    const deletableIds: string[] = [];
    const filePaths: string[] = [];

    // Track failures
    const failed: { id: string; reason: string }[] = [];

    for (const docId of documentIds) {
      const doc = foundDocs.get(docId);
      if (!doc) {
        failed.push({ id: docId, reason: 'Document not found' });
      } else if (doc.status === 'PROCESSING') {
        failed.push({ id: docId, reason: 'Cannot delete while processing' });
      } else {
        deletableIds.push(docId);
        filePaths.push(doc.filePath);
      }
    }

    // Delete all valid documents (chunks auto-deleted via CASCADE)
    let deletedCount = 0;
    if (deletableIds.length > 0) {
      const result = await prisma.document.deleteMany({ 
        where: { id: { in: deletableIds } } 
      });
      deletedCount = result.count;

      // Cleanup files (non-blocking)
      for (const filePath of filePaths) {
        rm(filePath).catch(() => {});
      }
    }

    // Emit bulk completion event
    if (deletedCount > 0) {
      eventBus.emit('bulk:completed', {
        operation: 'delete',
        count: deletedCount,
      });
    }

    return reply.send({
      deleted: deletedCount,
      failed,
    });
  });
}
