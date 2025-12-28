import { z } from 'zod';

// Schema for optional upload options
export const UploadSchema = z.object({
  ocrMode: z.enum(['auto', 'force', 'never']).default('auto'),
});

export type UploadOptions = z.infer<typeof UploadSchema>;

// Allowed formats - Phase 4 expanded
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/json',
  'text/plain',
  'text/markdown',
  'text/x-markdown', // Alternative MIME for .md
  // Phase 4: New formats
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'text/csv',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'text/html',
  'application/epub+zip',
]);

const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'json', 'txt', 'md',
  // Phase 4
  'docx', 'xlsx', 'csv', 'pptx', 'html', 'htm', 'epub',
]);

// Default max file size (used when no profile available)
const DEFAULT_MAX_FILE_SIZE_MB = 50;

interface FileInfo {
  filename: string;
  mimeType: string;
  size: number;
}

interface ValidationResult {
  valid: boolean;
  error?: {
    code: 'FILE_TOO_LARGE' | 'INVALID_FORMAT';
    message: string;
  };
}

/**
 * Validate upload file.
 * @param file - File info to validate
 * @param maxFileSizeMb - Max file size from profile (defaults to 50MB)
 */
export function validateUpload(file: FileInfo, maxFileSizeMb?: number): ValidationResult {
  const maxSizeMb = maxFileSizeMb ?? DEFAULT_MAX_FILE_SIZE_MB;
  const maxSizeBytes = maxSizeMb * 1024 * 1024;

  // Size check
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: `File exceeds ${maxSizeMb}MB limit`,
      },
    };
  }

  // Format check - by MIME type
  if (!ALLOWED_MIME_TYPES.has(file.mimeType)) {
    // Fallback to extension check
    const ext = file.filename.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
      return {
        valid: false,
        error: {
          code: 'INVALID_FORMAT',
          message: `Format not supported. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`,
        },
      };
    }
  }

  return { valid: true };
}
