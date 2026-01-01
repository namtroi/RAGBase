/**
 * Sync Service
 * 
 * Orchestrates synchronization between Google Drive folders and RAGBase.
 * Handles full sync and incremental updates via Changes API.
 */

import { getProcessingQueue } from '@/queue/processing-queue.js';
import { getPrismaClient } from '@/services/database.js';
import { UserDriveService } from '@/services/user-drive-service.js';
import { eventBus } from '@/services/event-bus.js';
import { HashService } from '@/services/hash-service.js';
import { detectFormat } from '@/validators/file-format-detector.js';
import { Prisma } from '@prisma/client';
import { mkdir, readFile, rm } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/tmp/uploads';

interface SyncResult {
    added: number;
    updated: number;
    removed: number;
    errors: string[];
}

export class SyncService {
    private driveService: UserDriveService | null = null;
    private prisma: ReturnType<typeof getPrismaClient>;

    constructor() {
        this.prisma = getPrismaClient();
    }

    private async getDrive(): Promise<UserDriveService> {
        if (!this.driveService) {
            this.driveService = await UserDriveService.create();
        }
        return this.driveService;
    }

    /**
     * Run sync for a specific DriveFolder
     */
    async syncConfig(configId: string): Promise<SyncResult> {
        const result: SyncResult = { added: 0, updated: 0, removed: 0, errors: [] };

        // Get config
        const config = await this.prisma.driveFolder.findUnique({
            where: { id: configId },
            include: { processingProfile: true },
        });

        if (!config) {
            throw new Error(`DriveFolder not found: ${configId}`);
        }

        if (!config.enabled) {
            return result;
        }

        // Update sync status
        await this.prisma.driveFolder.update({
            where: { id: configId },
            data: { syncStatus: 'SYNCING', syncError: null },
        });

        // Emit SSE event for sync start
        eventBus.emit('sync:start', { configId });

        try {
            // Build profile config from the drive config's assigned profile
            const processingProfileId = config.processingProfile?.id;
            const profileConfig = config.processingProfile ? {
                pdfConverter: config.processingProfile.pdfConverter,
                pdfOcrMode: config.processingProfile.pdfOcrMode,
                pdfOcrLanguages: config.processingProfile.pdfOcrLanguages,
                conversionTableRows: config.processingProfile.conversionTableRows,
                conversionTableCols: config.processingProfile.conversionTableCols,
                documentChunkSize: config.processingProfile.documentChunkSize,
                documentChunkOverlap: config.processingProfile.documentChunkOverlap,
                documentHeaderLevels: config.processingProfile.documentHeaderLevels,
                presentationMinChunk: config.processingProfile.presentationMinChunk,
                tabularRowsPerChunk: config.processingProfile.tabularRowsPerChunk,
                qualityMinChars: config.processingProfile.qualityMinChars,
                qualityMaxChars: config.processingProfile.qualityMaxChars,
                qualityPenaltyPerFlag: config.processingProfile.qualityPenaltyPerFlag,
                autoFixEnabled: config.processingProfile.autoFixEnabled,
                autoFixMaxPasses: config.processingProfile.autoFixMaxPasses,
            } : undefined;

            // Use incremental sync if we have a page token, otherwise full sync
            if (config.pageToken) {
                await this.incrementalSync(config.id, config.folderId, config.pageToken, result, processingProfileId, profileConfig);
            } else {
                await this.fullSync(config.id, config.folderId, config.recursive, result, processingProfileId, profileConfig);
            }

            // Update config after successful sync
            await this.prisma.driveFolder.update({
                where: { id: configId },
                data: {
                    syncStatus: 'IDLE',
                    lastSyncedAt: new Date(),
                    syncError: result.errors.length > 0 ? result.errors.join('; ') : null,
                },
            });

            // Emit SSE event for sync complete
            eventBus.emit('sync:complete', {
                configId,
                added: result.added,
                updated: result.updated,
                removed: result.removed
            });
        } catch (error: any) {
            // Update config with error
            await this.prisma.driveFolder.update({
                where: { id: configId },
                data: {
                    syncStatus: 'ERROR',
                    syncError: error.message,
                },
            });

            // Emit SSE event for sync error
            eventBus.emit('sync:error', { configId, error: error.message });

            throw error;
        }

        return result;
    }

    /**
     * Full sync - list all files and process new/changed ones
     */
    private async fullSync(
        configId: string,
        folderId: string,
        recursive: boolean,
        result: SyncResult,
        processingProfileId?: string,
        profileConfig?: Record<string, unknown>
    ): Promise<void> {
        // Get all files from Drive
        const drive = await this.getDrive();
        const driveFiles = recursive
            ? await drive.listAllFiles(folderId)
            : await drive.listAllFiles(folderId); // Use listAllFiles for both cases

        // Get existing documents for this config
        const existingDocs = await this.prisma.document.findMany({
            where: { driveFolderId: configId },
            select: { id: true, driveFileId: true, md5Hash: true },
        });

        const existingMap = new Map(existingDocs.map(d => [d.driveFileId, d]));
        const driveFileIds = new Set(driveFiles.map(f => f.id));

        // Process each Drive file
        for (const file of driveFiles) {
            try {
                const existing = existingMap.get(file.id);

                if (!existing) {
                    // New file
                    await this.addFile(configId, file, processingProfileId, profileConfig);
                    result.added++;
                } else if (file.md5Checksum && file.md5Checksum !== existing.md5Hash) {
                    // File changed
                    await this.updateFile(existing.id, file, configId, processingProfileId, profileConfig);
                    result.updated++;
                }
                // Skip unchanged files
            } catch (error: any) {
                result.errors.push(`${file.name}: ${error.message}`);
            }
        }

        // Mark removed files as archived
        for (const doc of existingDocs) {
            if (doc.driveFileId && !driveFileIds.has(doc.driveFileId)) {
                await this.prisma.document.update({
                    where: { id: doc.id },
                    data: { status: 'FAILED', failReason: 'REMOVED_FROM_DRIVE' },
                });
                result.removed++;
            }
        }

        // Get page token for future incremental syncs
        const pageToken = await (await this.getDrive()).getStartPageToken();
        await this.prisma.driveFolder.update({
            where: { id: configId },
            data: { pageToken },
        });
    }

    /**
     * Incremental sync using Changes API
     */
    private async incrementalSync(
        configId: string,
        folderId: string,
        pageToken: string,
        result: SyncResult,
        processingProfileId?: string,
        profileConfig?: Record<string, unknown>
    ): Promise<void> {
        let currentToken = pageToken;

        // Get existing documents for this config
        const existingDocs = await this.prisma.document.findMany({
            where: { driveFolderId: configId },
            select: { id: true, driveFileId: true },
        });
        const existingMap = new Map(existingDocs.map(d => [d.driveFileId, d]));

        // Process all changes
        const drive = await this.getDrive();
        let hasMore = true;
        while (hasMore) {
            const changes = await drive.getChanges(currentToken);

            for (const change of changes.changes) {
                try {
                    const existing = existingMap.get(change.fileId);

                    if (change.removed) {
                        // File removed
                        if (existing) {
                            await this.prisma.document.update({
                                where: { id: existing.id },
                                data: { status: 'FAILED', failReason: 'REMOVED_FROM_DRIVE' },
                            });
                            result.removed++;
                        }
                    } else if (change.file) {
                        // Check if file is in our folder (for non-recursive, this is simplified)
                        if (!existing) {
                            // New file
                            await this.addFile(configId, change.file, processingProfileId, profileConfig);
                            result.added++;
                        } else {
                            // Updated file
                            await this.updateFile(existing.id, change.file, configId, processingProfileId, profileConfig);
                            result.updated++;
                        }
                    }
                } catch (error: any) {
                    result.errors.push(`${change.fileId}: ${error.message}`);
                }
            }

            currentToken = changes.newStartPageToken;
            hasMore = currentToken !== pageToken;
        }

        // Update page token
        await this.prisma.driveFolder.update({
            where: { id: configId },
            data: { pageToken: currentToken },
        });
    }

    /**
     * Add a new file from Drive
     */
    private async addFile(
        configId: string,
        file: { id: string; name: string; mimeType: string; size: number; md5Checksum?: string; modifiedTime?: string; webViewLink?: string },
        processingProfileId?: string,
        profileConfig?: Record<string, unknown>
    ): Promise<void> {
        // 1. Global Lookup by driveFileId
        const existingByDriveId = await this.prisma.document.findUnique({
            where: { driveFileId: file.id },
        });

        if (existingByDriveId) {
            // Case: found existing by driveFileId
            const needsProcessing = file.md5Checksum && file.md5Checksum !== existingByDriveId.md5Hash;

            if (needsProcessing) {
                // Proceded to re-processing via updateFile
                await this.updateFile(existingByDriveId.id, file, configId, processingProfileId, profileConfig);
            } else {
                // Update config info and status (if it was FAILED/REMOVED)
                await this.prisma.document.update({
                    where: { id: existingByDriveId.id },
                    data: {
                        driveFolderId: configId,
                        driveWebViewLink: file.webViewLink ?? undefined,
                        driveModifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
                        connectionState: 'LINKED',
                        status: existingByDriveId.status === 'FAILED' && existingByDriveId.failReason === 'REMOVED_FROM_DRIVE'
                            ? 'COMPLETED'
                            : existingByDriveId.status,
                        failReason: existingByDriveId.failReason === 'REMOVED_FROM_DRIVE' ? null : existingByDriveId.failReason,
                        lastSyncedAt: new Date(),
                    },
                });
            }
            return;
        }

        // 2. Case: not found by driveFileId - proceed with existing logic
        // Detect format
        const format = detectFormat({ filename: file.name, mimeType: file.mimeType });
        if (!format) {
            throw new Error(`Unsupported format: ${file.mimeType}`);
        }

        // Download file
        const filePath = path.join(UPLOAD_DIR, `drive_${file.id}`);
        await mkdir(UPLOAD_DIR, { recursive: true });
        await (await this.getDrive()).downloadFile(file.id, filePath);

        // Calculate MD5 if not provided
        const fileBuffer = await readFile(filePath);
        const md5Hash = file.md5Checksum || HashService.md5(fileBuffer);

        // 3. Check for duplicate by md5Hash
        const existingByHash = await this.prisma.document.findUnique({
            where: { md5Hash },
        });

        if (existingByHash) {
            // Update existing to link to this drive file
            await this.prisma.document.update({
                where: { id: existingByHash.id },
                data: {
                    driveFileId: file.id,
                    driveFolderId: configId,
                    driveWebViewLink: file.webViewLink ?? undefined,
                    driveModifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
                    sourceType: 'DRIVE',
                    connectionState: 'LINKED',
                    lastSyncedAt: new Date(),
                },
            });
            // Clean up downloaded file
            await rm(filePath).catch(() => { });
            return;
        }

        // 4. Create new document
        const document = await this.prisma.document.create({
            data: {
                filename: file.name,
                mimeType: file.mimeType,
                fileSize: file.size,
                format,
                status: 'PENDING',
                filePath,
                md5Hash,
                sourceType: 'DRIVE',
                connectionState: 'LINKED',
                driveFileId: file.id,
                driveFolderId: configId,
                driveWebViewLink: file.webViewLink ?? undefined,
                driveModifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
                lastSyncedAt: new Date(),
                processingProfileId,
            },
        });

        // Queue for processing
        await getProcessingQueue().add('process', {
            documentId: document.id,
            filePath,
            format,
            config: {
                ocrMode: 'auto',
                ocrLanguages: ['en'],
                profileConfig,
            },
        });
    }

    /**
     * Update an existing file from Drive
     */
    private async updateFile(
        documentId: string,
        file: { id: string; name: string; mimeType: string; size: number; md5Checksum?: string; modifiedTime?: string; webViewLink?: string },
        configId?: string,
        processingProfileId?: string,
        profileConfig?: Record<string, unknown>
    ): Promise<void> {
        // Download new version
        const filePath = path.join(UPLOAD_DIR, `drive_${file.id}`);
        await (await this.getDrive()).downloadFile(file.id, filePath);

        // Calculate MD5
        const fileBuffer = await readFile(filePath);
        const md5Hash = file.md5Checksum || HashService.md5(fileBuffer);

        // Update document and reset for reprocessing
        await this.prisma.document.update({
            where: { id: documentId },
            data: {
                filename: file.name,
                fileSize: file.size,
                filePath,
                md5Hash,
                status: 'PENDING',
                processedContent: null,
                processingMetadata: Prisma.JsonNull,
                retryCount: 0,
                failReason: null,
                connectionState: 'LINKED',
                driveFolderId: configId, // Update config ID if provided during re-link
                driveWebViewLink: file.webViewLink ?? undefined,
                driveModifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
                lastSyncedAt: new Date(),
                processingProfileId,
            },
        });

        // Clear old chunks
        await this.prisma.chunk.deleteMany({
            where: { documentId },
        });

        // Queue for processing
        const format = detectFormat({ filename: file.name, mimeType: file.mimeType });
        if (!format) {
            throw new Error(`Unsupported format: ${file.mimeType}`);
        }
        await getProcessingQueue().add('process', {
            documentId,
            filePath,
            format,
            config: {
                ocrMode: 'auto',
                ocrLanguages: ['en'],
                profileConfig,
            },
        });
    }
}

// Singleton instance
let syncServiceInstance: SyncService | null = null;

export function getSyncService(): SyncService {
    if (!syncServiceInstance) {
        syncServiceInstance = new SyncService();
    }
    return syncServiceInstance;
}
