import { detectFormat, getFormatFromExtension, getFormatFromMimeType } from '@/validators/file-format-detector.js';
import { describe, expect, it } from 'vitest';

describe('detectFormat', () => {
  describe('MIME type detection', () => {
    it.each([
      { mimeType: 'application/pdf', expected: 'pdf' },
      { mimeType: 'application/json', expected: 'json' },
      { mimeType: 'text/plain', expected: 'txt' },
      { mimeType: 'text/markdown', expected: 'md' },
      { mimeType: 'text/x-markdown', expected: 'md' },
    ])('should detect $expected from MIME type $mimeType', ({ mimeType, expected }) => {
      const result = detectFormat({ mimeType, filename: 'test.unknown' });
      expect(result).toBe(expected);
    });
  });

  describe('extension fallback', () => {
    it.each([
      { filename: 'document.pdf', expected: 'pdf' },
      { filename: 'data.json', expected: 'json' },
      { filename: 'readme.txt', expected: 'txt' },
      { filename: 'notes.md', expected: 'md' },
      { filename: 'UPPERCASE.PDF', expected: 'pdf' },
      { filename: 'file.JSON', expected: 'json' },
    ])('should detect $expected from filename $filename', ({ filename, expected }) => {
      const result = detectFormat({ mimeType: 'application/octet-stream', filename });
      expect(result).toBe(expected);
    });
  });

  describe('unsupported formats', () => {
    it('should return null for unsupported MIME type and extension', () => {
      const result = detectFormat({ mimeType: 'image/png', filename: 'image.png' });
      expect(result).toBeNull();
    });

    it('should return null for file without extension', () => {
      const result = detectFormat({ mimeType: 'application/octet-stream', filename: 'noextension' });
      expect(result).toBeNull();
    });
  });
});

describe('getFormatFromMimeType', () => {
  it('should return format for known MIME type', () => {
    expect(getFormatFromMimeType('application/pdf')).toBe('pdf');
  });

  it('should return null for unknown MIME type', () => {
    expect(getFormatFromMimeType('application/unknown')).toBeNull();
  });
});

describe('getFormatFromExtension', () => {
  it('should return format for known extension', () => {
    expect(getFormatFromExtension('pdf')).toBe('pdf');
  });

  it('should handle extension with dot', () => {
    expect(getFormatFromExtension('.pdf')).toBe('pdf');
  });

  it('should be case insensitive', () => {
    expect(getFormatFromExtension('PDF')).toBe('pdf');
    expect(getFormatFromExtension('.JSON')).toBe('json');
  });

  it('should return null for unknown extension', () => {
    expect(getFormatFromExtension('xyz')).toBeNull();
  });
});
