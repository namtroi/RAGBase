import type { FileFormat } from '@prisma/client';

const MIME_TO_FORMAT: Record<string, FileFormat> = {
  'application/pdf': 'pdf',
  'application/json': 'json',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/x-markdown': 'md',
};

const EXT_TO_FORMAT: Record<string, FileFormat> = {
  pdf: 'pdf',
  json: 'json',
  txt: 'txt',
  md: 'md',
};

interface FileInfo {
  mimeType: string;
  filename: string;
}

export function detectFormat(file: FileInfo): FileFormat | null {
  // Try MIME type first
  const formatFromMime = getFormatFromMimeType(file.mimeType);
  if (formatFromMime) return formatFromMime;

  // Fallback to extension
  const ext = file.filename.split('.').pop();
  if (ext) {
    return getFormatFromExtension(ext);
  }

  return null;
}

export function getFormatFromMimeType(mimeType: string): FileFormat | null {
  return MIME_TO_FORMAT[mimeType] || null;
}

export function getFormatFromExtension(ext: string): FileFormat | null {
  const normalized = ext.replace(/^\./, '').toLowerCase();
  return EXT_TO_FORMAT[normalized] || null;
}
