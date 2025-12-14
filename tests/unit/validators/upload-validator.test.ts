import { describe, it, expect } from 'vitest';
// Import will fail until implementation exists - that's expected (RED)
import { UploadSchema, validateUpload } from '@/validators/upload-validator';

describe('UploadSchema', () => {
  describe('ocrMode validation', () => {
    it('should default ocrMode to "auto" when not provided', () => {
      const result = UploadSchema.parse({});
      expect(result.ocrMode).toBe('auto');
    });

    it.each(['auto', 'force', 'never'] as const)('should accept ocrMode "%s"', (mode) => {
      const result = UploadSchema.parse({ ocrMode: mode });
      expect(result.ocrMode).toBe(mode);
    });

    it('should reject invalid ocrMode', () => {
      expect(() => UploadSchema.parse({ ocrMode: 'invalid' })).toThrow();
    });
  });
});

describe('validateUpload', () => {
  describe('file size validation', () => {
    const maxSizeMB = 50;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    it('should accept file under size limit', () => {
      const result = validateUpload({
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        size: maxSizeBytes - 1,
      });
      expect(result.valid).toBe(true);
    });

    it('should accept file at exactly size limit', () => {
      const result = validateUpload({
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        size: maxSizeBytes,
      });
      expect(result.valid).toBe(true);
    });

    it('should reject file over size limit', () => {
      const result = validateUpload({
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        size: maxSizeBytes + 1,
      });
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('FILE_TOO_LARGE');
    });
  });

  describe('format validation', () => {
    it.each([
      { filename: 'doc.pdf', mimeType: 'application/pdf' },
      { filename: 'data.json', mimeType: 'application/json' },
      { filename: 'readme.txt', mimeType: 'text/plain' },
      { filename: 'notes.md', mimeType: 'text/markdown' },
    ])('should accept $filename with $mimeType', ({ filename, mimeType }) => {
      const result = validateUpload({ filename, mimeType, size: 1024 });
      expect(result.valid).toBe(true);
    });

    it.each([
      { filename: 'image.png', mimeType: 'image/png' },
      { filename: 'doc.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { filename: 'data.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { filename: 'video.mp4', mimeType: 'video/mp4' },
    ])('should reject $filename with $mimeType', ({ filename, mimeType }) => {
      const result = validateUpload({ filename, mimeType, size: 1024 });
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('INVALID_FORMAT');
    });
  });
});
