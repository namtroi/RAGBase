import { API_KEY, getTestApp, setupE2E, teardownE2E } from '@tests/e2e/setup/e2e-setup.js';
import { cleanDatabase } from '@tests/helpers/database.js';
import { FIXTURES, readFixture } from '@tests/helpers/fixtures.js';
import { ERRORS } from '@tests/mocks/python-worker-mock.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('E2E: Error Handling', () => {
  beforeAll(async () => {
    await setupE2E();
  }, 120000);

  afterAll(async () => {
    await teardownE2E();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('Password Protected PDF', () => {
    it('should reject password-protected PDF via callback', async () => {
      const app = getTestApp();
      const pdfBuffer = await readFixture(FIXTURES.pdf.passwordProtected);

      // Upload
      const uploadResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'multipart/form-data; boundary=---e2e',
        },
        payload: createMultipartPayload('protected.pdf', pdfBuffer, 'application/pdf'),
      });

      expect(uploadResponse.statusCode).toBe(201);
      const { id: documentId } = uploadResponse.json();

      // Simulate Python worker detecting password protection
      await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: ERRORS.passwordProtected(documentId),
      });

      // Check status
      const statusResponse = await app.inject({
        method: 'GET',
        url: `/api/documents/${documentId}`,
        headers: { 'X-API-Key': API_KEY },
      });

      expect(statusResponse.json().status).toBe('FAILED');
      expect(statusResponse.json().failReason).toBe('PASSWORD_PROTECTED');
    }, 30000);
  });

  describe('Quality Gate Rejection', () => {
    it('should fail document with too little text', async () => {
      const app = getTestApp();
      const pdfBuffer = await readFixture(FIXTURES.pdf.digital);

      // Upload
      const uploadResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'multipart/form-data; boundary=---e2e',
        },
        payload: createMultipartPayload('short.pdf', pdfBuffer, 'application/pdf'),
      });

      expect(uploadResponse.statusCode).toBe(201);
      const { id: documentId } = uploadResponse.json();

      // Simulate callback with short content
      await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: {
          documentId,
          success: true,
          result: {
            processedContent: 'Too short',
            chunks: [{
              content: 'Too short',
              index: 0,
              embedding: Array(384).fill(0.1),
              metadata: { charStart: 0, charEnd: 9 }
            }],
            pageCount: 1,
            ocrApplied: false,
            processingTimeMs: 100,
          },
        },
      });

      // Check status
      const statusResponse = await app.inject({
        method: 'GET',
        url: `/api/documents/${documentId}`,
        headers: { 'X-API-Key': API_KEY },
      });

      expect(statusResponse.json().status).toBe('FAILED');
      expect(statusResponse.json().failReason).toContain('TEXT_TOO_SHORT');
    }, 30000);

    it('should fail document with high noise ratio', async () => {
      const app = getTestApp();
      const pdfBuffer = await readFixture(FIXTURES.pdf.digital);

      const uploadResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'multipart/form-data; boundary=---e2e',
        },
        payload: createMultipartPayload('noisy.pdf', pdfBuffer, 'application/pdf'),
      });

      expect(uploadResponse.statusCode).toBe(201);
      const { id: documentId } = uploadResponse.json();

      // Simulate callback with noisy content (>80% special chars)
      const noisyContent = '!@#$%^&*(){}[]|\\/:;"\'<>,.?~`!@#$%^&*(){}[]|' + 'AB'.repeat(5);
      await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: {
          documentId,
          success: true,
          result: {
            processedContent: noisyContent,
            chunks: [{
              content: noisyContent,
              index: 0,
              embedding: Array(384).fill(0.1),
              metadata: { charStart: 0, charEnd: noisyContent.length }
            }],
            pageCount: 1,
            ocrApplied: true,
            processingTimeMs: 500,
          },
        },
      });

      const statusResponse = await app.inject({
        method: 'GET',
        url: `/api/documents/${documentId}`,
        headers: { 'X-API-Key': API_KEY },
      });

      expect(statusResponse.json().status).toBe('FAILED');
      expect(statusResponse.json().failReason).toContain('NOISE');
    }, 30000);
  });

  describe('Duplicate File Detection', () => {
    it('should reject upload of duplicate file', async () => {
      const app = getTestApp();
      const pdfBuffer = await readFixture(FIXTURES.pdf.digital);

      // First upload
      const firstUpload = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'multipart/form-data; boundary=---e2e',
        },
        payload: createMultipartPayload('first.pdf', pdfBuffer, 'application/pdf'),
      });

      expect(firstUpload.statusCode).toBe(201);

      // Second upload (same file content)
      const secondUpload = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'multipart/form-data; boundary=---e2e',
        },
        payload: createMultipartPayload('second.pdf', pdfBuffer, 'application/pdf'),
      });

      expect(secondUpload.statusCode).toBe(409);
      expect(secondUpload.json().error).toBe('DUPLICATE_FILE');
      expect(secondUpload.json().existingId).toBe(firstUpload.json().id);
    }, 30000);
  });

  describe('Unsupported Format', () => {
    it('should reject unsupported file format', async () => {
      const app = getTestApp();

      const uploadResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'multipart/form-data; boundary=---e2e',
        },
        payload: createMultipartPayload('image.png', Buffer.from('fake'), 'image/png'),
      });

      expect(uploadResponse.statusCode).toBe(400);
      expect(uploadResponse.json().error).toBe('INVALID_FORMAT');
    });
  });

  describe('File Size Limit', () => {
    it('should reject file exceeding 50MB', async () => {
      const app = getTestApp();
      const largeBuffer = Buffer.alloc(51 * 1024 * 1024); // 51MB

      const uploadResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'multipart/form-data; boundary=---e2e',
        },
        payload: createMultipartPayload('large.pdf', largeBuffer, 'application/pdf'),
      });

      expect(uploadResponse.statusCode).toBe(413); // Payload Too Large is the correct HTTP status
      expect(uploadResponse.json().error).toBe('INTERNAL_ERROR');
    });
  });

  describe('Corrupt File', () => {
    it('should fail corrupt PDF via callback', async () => {
      const app = getTestApp();
      const corruptBuffer = await readFixture(FIXTURES.pdf.corrupt);

      const uploadResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'multipart/form-data; boundary=---e2e',
        },
        payload: createMultipartPayload('corrupt.pdf', corruptBuffer, 'application/pdf'),
      });

      expect(uploadResponse.statusCode).toBe(201);
      const { id: documentId } = uploadResponse.json();

      // Simulate Python worker detecting corruption
      await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: ERRORS.corrupt(documentId),
      });

      const statusResponse = await app.inject({
        method: 'GET',
        url: `/api/documents/${documentId}`,
        headers: { 'X-API-Key': API_KEY },
      });

      expect(statusResponse.json().status).toBe('FAILED');
      expect(statusResponse.json().failReason).toBe('CORRUPT_FILE');
    }, 30000);
  });
});

function createMultipartPayload(filename: string, buffer: Buffer, mimeType: string): Buffer {
  const boundary = '---e2e';
  const parts: Buffer[] = [];

  // Opening boundary
  parts.push(Buffer.from(`--${boundary}\r\n`));

  // Content-Disposition and Content-Type headers
  parts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`));
  parts.push(Buffer.from(`Content-Type: ${mimeType}\r\n\r\n`));

  // File content
  parts.push(buffer);

  // Closing boundary
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  return Buffer.concat(parts);
}
