import { getProcessingQueue } from '@/queue/processing-queue.js';
import { getPrismaClient } from '@/services/database.js';
import { getDriveService } from '@/services/drive-service.js';
import { SyncService } from '@/services/sync-service.js';
import { mkdir, readFile, rm } from 'fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@/services/database.js');
vi.mock('@/services/drive-service.js');
vi.mock('@/queue/processing-queue.js');
vi.mock('fs/promises');

describe('SyncService Re-link Logic', () => {
    let syncService: SyncService;
    let mockPrisma: any;
    let mockDriveService: any;
    let mockQueue: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup mock Prisma
        mockPrisma = {
            document: {
                findUnique: vi.fn(),
                create: vi.fn(),
                update: vi.fn(),
            },
            chunk: {
                deleteMany: vi.fn(),
            },
        };
        (getPrismaClient as any).mockReturnValue(mockPrisma);

        // Setup mock DriveService
        mockDriveService = {
            downloadFile: vi.fn().mockResolvedValue(undefined),
            getStartPageToken: vi.fn().mockResolvedValue('token123'),
        };
        (getDriveService as any).mockReturnValue(mockDriveService);

        // Setup mock Queue
        mockQueue = {
            add: vi.fn().mockResolvedValue(undefined),
        };
        (getProcessingQueue as any).mockReturnValue(mockQueue);

        // Mock fs functions
        (mkdir as any).mockResolvedValue(undefined);
        (readFile as any).mockResolvedValue(Buffer.from('test content'));
        (rm as any).mockResolvedValue(undefined);

        syncService = new SyncService();
    });

    describe('addFile re-link behavior', () => {
        const configId = 'config-123';
        const file = {
            id: 'file-123',
            name: 'test.pdf',
            mimeType: 'application/pdf',
            size: 1024,
            md5Checksum: 'hash123',
        };

        it('should re-link by driveFileId when content is unchanged', async () => {
            // Mock existing document found by driveFileId
            mockPrisma.document.findUnique.mockResolvedValueOnce({
                id: 'doc-123',
                driveFileId: file.id,
                md5Hash: file.md5Checksum, // Same hash
                status: 'COMPLETED',
                failReason: null,
            });

            // Cast private method for testing
            await (syncService as any).addFile(configId, file);

            // Should NOT download or re-process
            expect(mockDriveService.downloadFile).not.toHaveBeenCalled();
            expect(mockQueue.add).not.toHaveBeenCalled();

            // Should update document with new config and set connectionState to LINKED
            expect(mockPrisma.document.update).toHaveBeenCalledWith({
                where: { id: 'doc-123' },
                data: expect.objectContaining({
                    driveConfigId: configId,
                    connectionState: 'LINKED',
                }),
            });
        });

        it('should re-link and re-process by driveFileId when content changed', async () => {
            // Mock existing document found by driveFileId
            mockPrisma.document.findUnique.mockResolvedValueOnce({
                id: 'doc-123',
                driveFileId: file.id,
                md5Hash: 'old-hash', // Different hash
                status: 'COMPLETED',
            });

            await (syncService as any).addFile(configId, file);

            // Should download and re-process
            expect(mockDriveService.downloadFile).toHaveBeenCalled();
            expect(mockQueue.add).toHaveBeenCalled();

            // Should update document as PENDING
            expect(mockPrisma.document.update).toHaveBeenCalledWith({
                where: { id: 'doc-123' },
                data: expect.objectContaining({
                    status: 'PENDING',
                    connectionState: 'LINKED',
                    driveConfigId: configId,
                }),
            });
        });

        it('should re-link by md5Hash when driveFileId is new', async () => {
            // 1. Global lookup by driveFileId fails
            mockPrisma.document.findUnique.mockResolvedValueOnce(null);

            // 2. MD5 lookup (after download) succeeds
            mockPrisma.document.findUnique.mockResolvedValueOnce({
                id: 'doc-123',
                md5Hash: file.md5Checksum,
                driveFileId: null, // Previously standalone or from different drive file
            });

            await (syncService as any).addFile(configId, file);

            // Should download
            expect(mockDriveService.downloadFile).toHaveBeenCalled();

            // Should update existing doc to link with new drive ID
            expect(mockPrisma.document.update).toHaveBeenCalledWith({
                where: { id: 'doc-123' },
                data: expect.objectContaining({
                    driveFileId: file.id,
                    driveConfigId: configId,
                    connectionState: 'LINKED',
                    sourceType: 'DRIVE',
                }),
            });
        });

        it('should restore REMOVED_FROM_DRIVE document if found again', async () => {
            mockPrisma.document.findUnique.mockResolvedValueOnce({
                id: 'doc-123',
                driveFileId: file.id,
                md5Hash: file.md5Checksum,
                status: 'FAILED',
                failReason: 'REMOVED_FROM_DRIVE',
            });

            await (syncService as any).addFile(configId, file);

            // Should update status to COMPLETED and clear failReason
            expect(mockPrisma.document.update).toHaveBeenCalledWith({
                where: { id: 'doc-123' },
                data: expect.objectContaining({
                    status: 'COMPLETED',
                    failReason: null,
                }),
            });
        });

        it('should create new document if no re-link possible', async () => {
            // No lookup matches
            mockPrisma.document.findUnique.mockResolvedValue(null);
            mockPrisma.document.create.mockResolvedValue({ id: 'new-doc-123' });

            await (syncService as any).addFile(configId, file);

            // Should create new doc with LINKED state
            expect(mockPrisma.document.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    driveFileId: file.id,
                    connectionState: 'LINKED',
                    status: 'PENDING',
                }),
            });
        });
    });
});
