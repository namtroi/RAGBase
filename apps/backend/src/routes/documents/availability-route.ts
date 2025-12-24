/**
 * Availability Route
 * 
 * Endpoints to toggle document availability (isActive).
 * Only COMPLETED documents can have their availability toggled.
 */

import { eventBus } from '@/services/event-bus.js';
import { getPrismaClient } from '@/services/database.js';
import {
  BulkToggleAvailabilitySchema,
  DocumentIdParamsSchema,
  ToggleAvailabilitySchema,
} from '@/validators/availability-validator.js';
import { FastifyInstance } from 'fastify';

export async function availabilityRoute(fastify: FastifyInstance): Promise<void> {
  const prisma = getPrismaClient();

  /**
   * PATCH /api/documents/:id/availability
   * Toggle availability for a single document
   */
  fastify.patch('/api/documents/:id/availability', async (request, reply) => {
    // Validate params
    const paramsResult = DocumentIdParamsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return reply.status(400).send({
        error: 'INVALID_ID',
        message: 'Invalid document ID format',
      });
    }

    // Validate body
    const bodyResult = ToggleAvailabilitySchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: bodyResult.error.errors[0]?.message || 'Invalid request body',
      });
    }

    const { id } = paramsResult.data;
    const { isActive } = bodyResult.data;

    // Find document
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, status: true, isActive: true },
    });

    if (!document) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Document not found',
      });
    }

    // Only COMPLETED documents can be toggled
    if (document.status !== 'COMPLETED') {
      return reply.status(400).send({
        error: 'INVALID_STATUS',
        message: `Cannot toggle availability for ${document.status} documents. Only COMPLETED documents can be toggled.`,
      });
    }

    // Update availability
    const updated = await prisma.document.update({
      where: { id },
      data: { isActive },
      select: { id: true, isActive: true, updatedAt: true },
    });

    // Emit SSE event
    eventBus.emit('document:availability', {
      id: updated.id,
      isActive: updated.isActive,
    });

    return reply.send({
      id: updated.id,
      isActive: updated.isActive,
      updatedAt: updated.updatedAt.toISOString(),
    });
  });

  /**
   * PATCH /api/documents/bulk/availability
   * Toggle availability for multiple documents
   */
  fastify.patch('/api/documents/bulk/availability', async (request, reply) => {
    // Validate body
    const bodyResult = BulkToggleAvailabilitySchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: bodyResult.error.errors[0]?.message || 'Invalid request body',
      });
    }

    const { documentIds, isActive } = bodyResult.data;

    // Fetch all documents
    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds } },
      select: { id: true, status: true },
    });

    // Build sets for quick lookup
    const foundIds = new Set(documents.map(d => d.id));
    const completedIds = documents
      .filter(d => d.status === 'COMPLETED')
      .map(d => d.id);

    // Track failures
    const failed: { id: string; reason: string }[] = [];

    for (const docId of documentIds) {
      if (!foundIds.has(docId)) {
        failed.push({ id: docId, reason: 'Document not found' });
      } else {
        const doc = documents.find(d => d.id === docId);
        if (doc && doc.status !== 'COMPLETED') {
          failed.push({ 
            id: docId, 
            reason: `Cannot toggle ${doc.status} document` 
          });
        }
      }
    }

    // Update all valid documents
    let updatedCount = 0;
    if (completedIds.length > 0) {
      const result = await prisma.document.updateMany({
        where: { id: { in: completedIds } },
        data: { isActive },
      });
      updatedCount = result.count;
    }

    // Emit bulk completion event
    if (updatedCount > 0) {
      eventBus.emit('bulk:completed', {
        operation: 'toggle',
        count: updatedCount,
        isActive,
      });
    }

    return reply.send({
      updated: updatedCount,
      failed,
    });
  });
}
