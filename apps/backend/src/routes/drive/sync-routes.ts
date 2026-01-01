/**
 * Drive Sync Routes
 * 
 * Endpoint for triggering manual sync of Drive folders.
 */

import { getPrismaClient } from '@/services/database.js';
import { getSyncService } from '@/services/sync-service.js';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const IdParamSchema = z.object({
    configId: z.string().uuid(),
});

export async function driveSyncRoutes(fastify: FastifyInstance): Promise<void> {
    const prisma = getPrismaClient();

    /**
     * POST /api/drive/sync/:configId/trigger - Trigger manual sync
     */
    fastify.post('/api/drive/sync/:configId/trigger', async (request, reply) => {
        const params = IdParamSchema.safeParse(request.params);
        if (!params.success) {
            return reply.status(400).send({
                error: 'INVALID_ID',
                message: 'Invalid config ID format',
            });
        }

        // Check if config exists
        const config = await prisma.driveFolder.findUnique({
            where: { id: params.data.configId },
        });

        if (!config) {
            return reply.status(404).send({
                error: 'NOT_FOUND',
                message: 'Drive config not found',
            });
        }

        // Check if already syncing
        if (config.syncStatus === 'SYNCING') {
            return reply.status(409).send({
                error: 'SYNC_IN_PROGRESS',
                message: 'Sync is already in progress',
            });
        }

        // Start sync in background
        const syncService = getSyncService();

        // Don't await - run in background
        syncService.syncConfig(config.id).catch(err => {
            console.error(`Sync failed for config ${config.id}:`, err);
        });

        return reply.status(202).send({
            message: 'Sync started',
            configId: config.id,
            status: 'SYNCING',
        });
    });

    /**
     * GET /api/drive/sync/:configId/status - Get sync status
     */
    fastify.get('/api/drive/sync/:configId/status', async (request, reply) => {
        const params = IdParamSchema.safeParse(request.params);
        if (!params.success) {
            return reply.status(400).send({
                error: 'INVALID_ID',
                message: 'Invalid config ID format',
            });
        }

        const config = await prisma.driveFolder.findUnique({
            where: { id: params.data.configId },
            select: {
                id: true,
                syncStatus: true,
                syncError: true,
                lastSyncedAt: true,
            },
        });

        if (!config) {
            return reply.status(404).send({
                error: 'NOT_FOUND',
                message: 'Drive config not found',
            });
        }

        return reply.send({
            configId: config.id,
            status: config.syncStatus,
            error: config.syncError,
            lastSyncedAt: config.lastSyncedAt?.toISOString(),
        });
    });
}
