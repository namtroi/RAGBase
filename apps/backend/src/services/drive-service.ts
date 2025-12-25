/**
 * Google Drive Service
 * 
 * Handles Google Drive API interactions using Service Account authentication.
 * Provides methods for listing files, downloading files, and tracking changes.
 */

import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { drive_v3, google } from 'googleapis';
import path from 'path';

// Supported file MIME types that can be processed
const SUPPORTED_MIME_TYPES = [
    'application/pdf',
    'application/json',
    'text/plain',
    'text/markdown',
    'text/x-markdown',
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

interface ChangesResult {
    changes: Array<{
        fileId: string;
        removed: boolean;
        file?: DriveFile;
    }>;
    newStartPageToken: string;
}

export class DriveService {
    private drive: drive_v3.Drive;

    constructor() {
        // Initialize with service account credentials
        const credentials = this.getCredentials();

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });

        this.drive = google.drive({ version: 'v3', auth });
    }

    /**
     * Get credentials from environment or file
     */
    private getCredentials() {
        const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
        if (credentialsJson) {
            return JSON.parse(credentialsJson);
        }

        // Fall back to file path
        const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        if (credentialsPath) {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            return require(credentialsPath);
        }

        throw new Error('Google Drive credentials not configured. Set GOOGLE_APPLICATION_CREDENTIALS_JSON or GOOGLE_APPLICATION_CREDENTIALS');
    }

    /**
     * List files in a folder
     */
    async listFiles(folderId: string, pageToken?: string, recursive = true): Promise<ListFilesResult> {
        const query = recursive
            ? `'${folderId}' in parents and trashed = false`
            : `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`;

        const response = await this.drive.files.list({
            q: query,
            fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, md5Checksum, webViewLink)',
            pageSize: 100,
            pageToken,
        });

        const files: DriveFile[] = (response.data.files || [])
            .filter(f => SUPPORTED_MIME_TYPES.includes(f.mimeType || ''))
            .map(f => ({
                id: f.id!,
                name: f.name!,
                mimeType: f.mimeType!,
                size: parseInt(f.size || '0', 10),
                modifiedTime: f.modifiedTime!,
                md5Checksum: f.md5Checksum ?? undefined,
                webViewLink: f.webViewLink ?? undefined,
            }));

        return {
            files,
            nextPageToken: response.data.nextPageToken || undefined,
        };
    }

    /**
     * List all files recursively, handling folders
     */
    async listAllFiles(folderId: string): Promise<DriveFile[]> {
        const allFiles: DriveFile[] = [];
        const foldersToProcess = [folderId];

        while (foldersToProcess.length > 0) {
            const currentFolderId = foldersToProcess.pop()!;
            let pageToken: string | undefined;

            do {
                // Get all items in folder (including subfolders)
                const response = await this.drive.files.list({
                    q: `'${currentFolderId}' in parents and trashed = false`,
                    fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, md5Checksum, webViewLink)',
                    pageSize: 100,
                    pageToken,
                });

                for (const file of response.data.files || []) {
                    if (file.mimeType === 'application/vnd.google-apps.folder') {
                        // Add subfolder to process
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

        return allFiles;
    }

    /**
     * Download a file to local path
     */
    async downloadFile(fileId: string, destPath: string): Promise<void> {
        // Ensure directory exists
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
     * Get the start page token for changes tracking
     */
    async getStartPageToken(): Promise<string> {
        const response = await this.drive.changes.getStartPageToken({});
        return response.data.startPageToken!;
    }

    /**
     * Get changes since the last page token
     */
    async getChanges(pageToken: string): Promise<ChangesResult> {
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

    /**
     * Get folder metadata (to validate folder ID)
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
}

// Singleton instance
let driveServiceInstance: DriveService | null = null;

export function getDriveService(): DriveService {
    if (!driveServiceInstance) {
        driveServiceInstance = new DriveService();
    }
    return driveServiceInstance;
}
