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

// Config (from env)
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

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

export function validateUpload(file: FileInfo): ValidationResult {
  // Size check
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: `File exceeds ${MAX_FILE_SIZE_MB}MB limit`,
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
