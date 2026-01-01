/**
 * Drive Config Routes
 * 
 * CRUD endpoints for managing Google Drive folder configurations.
 */

import { getPrismaClient } from '@/services/database.js';
import { UserDriveService } from '@/services/user-drive-service.js';
import { eventBus } from '@/services/event-bus.js';
import { getSyncService } from '@/services/sync-service.js';
import { logger } from '@/logging/logger.js';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const CreateConfigSchema = z.object({
    folderId: z.string().min(1),
    folderName: z.string().optional(), // Optional: provided by Google Picker, otherwise fetched from Drive
    syncCron: z.string().default('0 */6 * * *'),
    recursive: z.boolean().default(true),
    enabled: z.boolean().default(true),
});

const UpdateConfigSchema = z.object({
    syncCron: z.string().optional(),
    recursive: z.boolean().optional(),
    enabled: z.boolean().optional(),
});

const IdParamSchema = z.object({
    id: z.string().uuid(),
});

export async function driveConfigRoutes(fastify: FastifyInstance): Promise<void> {
    const prisma = getPrismaClient();

    /**
     * POST /api/drive/configs - Add a new Drive folder
     */
    fastify.post('/api/drive/configs', async (request, reply) => {
        const input = CreateConfigSchema.safeParse(request.body);
        if (!input.success) {
            return reply.status(400).send({
                error: 'VALIDATION_ERROR',
                message: input.error.message,
            });
        }

        const { folderId, folderName: providedFolderName, syncCron, recursive, enabled } = input.data;

        // Check if folder already configured
        const existing = await prisma.driveFolder.findUnique({
            where: { folderId },
        });

        if (existing) {
            return reply.status(409).send({
                error: 'FOLDER_ALREADY_CONFIGURED',
                message: 'This folder is already configured for sync',
                existingId: existing.id,
            });
        }

        // Use provided name (from Picker) or fetch from Drive API
        let folderName: string;
        if (providedFolderName) {
            folderName = providedFolderName;
        } else {
            try {
                const driveService = await UserDriveService.create();
                const folder = await driveService.getFolder(folderId);
                if (!folder) {
                    return reply.status(400).send({
                        error: 'INVALID_FOLDER',
                        message: 'Folder not found or is not a folder',
                    });
                }
                folderName = folder.name;
            } catch (error: any) {
                logger.error({ error: error.message }, 'drive_folder_validation_failed');
                return reply.status(400).send({
                    error: 'DRIVE_ERROR',
                    message: `Failed to access folder: ${error.message}`,
                });
            }
        }

        // Create config
        const config = await prisma.driveFolder.create({
            data: {
                folderId,
                folderName,
                syncCron,
                recursive,
                enabled,
            },
        });

        // Trigger initial sync in background (don't await)
        if (enabled) {
            getSyncService().syncConfig(config.id).catch((err) => {
                logger.error({ configId: config.id, err }, 'drive_initial_sync_failed');
            });
        }

        return reply.status(201).send(config);
    });

    /**
     * GET /api/drive/configs - List all Drive folder configs
     */
    fastify.get('/api/drive/configs', async (request, reply) => {
        const configs = await prisma.driveFolder.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { documents: true },
                },
            },
        });

        return reply.send({
            configs: configs.map(c => ({
                id: c.id,
                folderId: c.folderId,
                folderName: c.folderName,
                syncCron: c.syncCron,
                recursive: c.recursive,
                enabled: c.enabled,
                syncStatus: c.syncStatus,
                syncError: c.syncError,
                lastSyncedAt: c.lastSyncedAt?.toISOString(),
                documentCount: c._count.documents,
                createdAt: c.createdAt.toISOString(),
                updatedAt: c.updatedAt.toISOString(),
            })),
        });
    });

    /**
     * GET /api/drive/configs/:id - Get a specific Drive folder config
     */
    fastify.get('/api/drive/configs/:id', async (request, reply) => {
        const params = IdParamSchema.safeParse(request.params);
        if (!params.success) {
            return reply.status(400).send({
                error: 'INVALID_ID',
                message: 'Invalid config ID format',
            });
        }

        const config = await prisma.driveFolder.findUnique({
            where: { id: params.data.id },
            include: {
                _count: {
                    select: { documents: true },
                },
            },
        });

        if (!config) {
            return reply.status(404).send({
                error: 'NOT_FOUND',
                message: 'Drive config not found',
            });
        }

        return reply.send({
            id: config.id,
            folderId: config.folderId,
            folderName: config.folderName,
            syncCron: config.syncCron,
            recursive: config.recursive,
            enabled: config.enabled,
            syncStatus: config.syncStatus,
            syncError: config.syncError,
            lastSyncedAt: config.lastSyncedAt?.toISOString(),
            documentCount: config._count.documents,
            createdAt: config.createdAt.toISOString(),
            updatedAt: config.updatedAt.toISOString(),
        });
    });

    /**
     * PATCH /api/drive/configs/:id - Update a Drive folder config
     */
    fastify.patch('/api/drive/configs/:id', async (request, reply) => {
        const params = IdParamSchema.safeParse(request.params);
        if (!params.success) {
            return reply.status(400).send({
                error: 'INVALID_ID',
                message: 'Invalid config ID format',
            });
        }

        const input = UpdateConfigSchema.safeParse(request.body);
        if (!input.success) {
            return reply.status(400).send({
                error: 'VALIDATION_ERROR',
                message: input.error.message,
            });
        }

        // Check if config exists
        const existing = await prisma.driveFolder.findUnique({
            where: { id: params.data.id },
        });

        if (!existing) {
            return reply.status(404).send({
                error: 'NOT_FOUND',
                message: 'Drive config not found',
            });
        }

        // Update config
        const config = await prisma.driveFolder.update({
            where: { id: params.data.id },
            data: input.data,
        });

        return reply.send({
            id: config.id,
            folderId: config.folderId,
            folderName: config.folderName,
            syncCron: config.syncCron,
            recursive: config.recursive,
            enabled: config.enabled,
            syncStatus: config.syncStatus,
            lastSyncedAt: config.lastSyncedAt?.toISOString(),
            updatedAt: config.updatedAt.toISOString(),
        });
    });

    /**
     * DELETE /api/drive/configs/:id - Remove a Drive folder config
     */
    fastify.delete('/api/drive/configs/:id', async (request, reply) => {
        const params = IdParamSchema.safeParse(request.params);
        if (!params.success) {
            return reply.status(400).send({
                error: 'INVALID_ID',
                message: 'Invalid config ID format',
            });
        }

        // Check if config exists
        const existing = await prisma.driveFolder.findUnique({
            where: { id: params.data.id },
        });

        if (!existing) {
            return reply.status(404).send({
                error: 'NOT_FOUND',
                message: 'Drive config not found',
            });
        }

        // Delete folder (documents will have driveFolderId set to null due to onDelete: SetNull)
        // First, update connectionState to STANDALONE for all linked documents
        await prisma.document.updateMany({
            where: { driveFolderId: params.data.id },
            data: { connectionState: 'STANDALONE' },
        });

        await prisma.driveFolder.delete({
            where: { id: params.data.id },
        });

        // Emit SSE event for frontend update
        eventBus.emit('driveFolder:deleted', { configId: params.data.id });

        return reply.status(204).send();
    });
}
