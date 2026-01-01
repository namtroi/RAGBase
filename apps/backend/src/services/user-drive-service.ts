/**
 * User Drive Service
 *
 * Phase 5F: Google Drive service using per-user OAuth credentials.
 * Decrypts stored refresh tokens with AES-256-GCM.
 * Falls back to service account if no OAuth configured.
 */

import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { drive_v3, google } from 'googleapis';
import path from 'path';
import { getPrismaClient } from './database.js';
import { getEncryptionService } from './encryption.service.js';
import { logger } from '../logging/logger.js';

// Supported file MIME types that can be processed
const SUPPORTED_MIME_TYPES = [
    'application/pdf',
    'application/json',
    'text/plain',
    'text/markdown',
    'text/x-markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
    'text/html',
    'text/csv',
    'application/epub+zip',
];

interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    modifiedTime: string;
    md5Checksum?: string;
    webViewLink?: string;
}

interface ListFilesResult {
    files: DriveFile[];
    nextPageToken?: string;
}

export class UserDriveService {
    private drive: drive_v3.Drive;
    private authType: 'oauth' | 'service_account';

    private constructor(drive: drive_v3.Drive, authType: 'oauth' | 'service_account') {
        this.drive = drive;
        this.authType = authType;
    }

    /**
     * Create a UserDriveService instance.
     * Attempts OAuth first, falls back to service account.
     */
    static async create(): Promise<UserDriveService> {
        const prisma = getPrismaClient();

        // Try OAuth first
        const oauth = await prisma.driveOAuth.findUnique({
            where: { id: 'system' },
        });

        if (oauth?.encryptedRefreshToken) {
            try {
                const drive = await UserDriveService.createOAuthDrive(oauth);
                logger.debug('user_drive_service_using_oauth');
                return new UserDriveService(drive, 'oauth');
            } catch (error: any) {
                logger.warn({ error: error.message }, 'oauth_drive_failed_fallback_service_account');
            }
        }

        // Fall back to service account
        const drive = UserDriveService.createServiceAccountDrive();
        logger.debug('user_drive_service_using_service_account');
        return new UserDriveService(drive, 'service_account');
    }

    /**
     * Create Drive client using OAuth credentials
     */
    private static async createOAuthDrive(oauth: {
        encryptedRefreshToken: string;
        tokenIv: string;
        tokenAuthTag: string;
    }): Promise<drive_v3.Drive> {
        const encryption = getEncryptionService();

        // Decrypt refresh token
        const refreshToken = encryption.decrypt({
            ciphertext: oauth.encryptedRefreshToken,
            iv: oauth.tokenIv,
            authTag: oauth.tokenAuthTag,
        });

        // Create OAuth2 client
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required for OAuth');
        }

        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
        oauth2Client.setCredentials({ refresh_token: refreshToken });

        return google.drive({ version: 'v3', auth: oauth2Client });
    }

    /**
     * Create Drive client using service account
     */
    private static createServiceAccountDrive(): drive_v3.Drive {
        const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
        let credentials;

        if (credentialsJson) {
            credentials = JSON.parse(credentialsJson);
        } else {
            const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
            if (credentialsPath) {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                credentials = require(credentialsPath);
            } else {
                throw new Error('No Google credentials configured');
            }
        }

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });

        return google.drive({ version: 'v3', auth });
    }

    /**
     * Get the authentication type being used
     */
    getAuthType(): 'oauth' | 'service_account' {
        return this.authType;
    }

    /**
     * List all files recursively
     */
    async listAllFiles(folderId: string): Promise<DriveFile[]> {
        const allFiles: DriveFile[] = [];
        const foldersToProcess = [folderId];

        logger.info({ folderId }, 'listAllFiles_starting');

        while (foldersToProcess.length > 0) {
            const currentFolderId = foldersToProcess.pop()!;
            let pageToken: string | undefined;

            logger.debug({ currentFolderId }, 'listAllFiles_processing_folder');

            do {
                const query = `'${currentFolderId}' in parents and trashed = false`;
                logger.debug({ query }, 'listAllFiles_query');

                const response = await this.drive.files.list({
                    q: query,
                    fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, md5Checksum, webViewLink)',
                    pageSize: 100,
                    pageToken,
                });

                const filesInPage = response.data.files || [];
                logger.debug({ count: filesInPage.length }, 'listAllFiles_page_result');

                for (const file of filesInPage) {
                    if (file.mimeType === 'application/vnd.google-apps.folder') {
                        foldersToProcess.push(file.id!);
                    } else if (SUPPORTED_MIME_TYPES.includes(file.mimeType || '')) {
                        allFiles.push({
                            id: file.id!,
                            name: file.name!,
                            mimeType: file.mimeType!,
                            size: parseInt(file.size || '0', 10),
                            modifiedTime: file.modifiedTime!,
                            md5Checksum: file.md5Checksum ?? undefined,
                            webViewLink: file.webViewLink ?? undefined,
                        });
                    }
                }

                pageToken = response.data.nextPageToken || undefined;
            } while (pageToken);
        }

        logger.info({ folderId, totalFiles: allFiles.length }, 'listAllFiles_complete');
        return allFiles;
    }

    /**
     * Download a file to local path
     */
    async downloadFile(fileId: string, destPath: string): Promise<void> {
        await mkdir(path.dirname(destPath), { recursive: true });

        const response = await this.drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'stream' }
        );

        return new Promise((resolve, reject) => {
            const dest = createWriteStream(destPath);
            (response.data as NodeJS.ReadableStream)
                .on('error', reject)
                .pipe(dest)
                .on('finish', resolve)
                .on('error', reject);
        });
    }

    /**
     * Get folder metadata
     */
    async getFolder(folderId: string): Promise<{ id: string; name: string } | null> {
        try {
            const response = await this.drive.files.get({
                fileId: folderId,
                fields: 'id, name, mimeType',
            });

            if (response.data.mimeType !== 'application/vnd.google-apps.folder') {
                return null;
            }

            return {
                id: response.data.id!,
                name: response.data.name!,
            };
        } catch {
            return null;
        }
    }

    /**
     * Get start page token for changes tracking
     */
    async getStartPageToken(): Promise<string> {
        const response = await this.drive.changes.getStartPageToken({});
        return response.data.startPageToken!;
    }

    /**
     * Get changes since page token
     */
    async getChanges(pageToken: string): Promise<{
        changes: Array<{ fileId: string; removed: boolean; file?: DriveFile }>;
        newStartPageToken: string;
    }> {
        const response = await this.drive.changes.list({
            pageToken,
            fields: 'newStartPageToken, nextPageToken, changes(fileId, removed, file(id, name, mimeType, size, modifiedTime, md5Checksum, webViewLink))',
            pageSize: 100,
        });

        const changes = (response.data.changes || []).map(change => ({
            fileId: change.fileId!,
            removed: change.removed || false,
            file: change.file && SUPPORTED_MIME_TYPES.includes(change.file.mimeType || '')
                ? {
                    id: change.file.id!,
                    name: change.file.name!,
                    mimeType: change.file.mimeType!,
                    size: parseInt(change.file.size || '0', 10),
                    modifiedTime: change.file.modifiedTime!,
                    md5Checksum: change.file.md5Checksum ?? undefined,
                    webViewLink: change.file.webViewLink ?? undefined,
                }
                : undefined,
        }));

        return {
            changes,
            newStartPageToken: response.data.newStartPageToken || response.data.nextPageToken || pageToken,
        };
    }
}

/**
 * Factory function to get UserDriveService
 */
export async function getUserDriveService(): Promise<UserDriveService> {
    return UserDriveService.create();
}
