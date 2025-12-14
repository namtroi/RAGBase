import { closeTestApp, createTestApp } from '@tests/helpers/api';
import { cleanDatabase, getPrisma } from '@tests/helpers/database';
import { FIXTURES, readFixture } from '@tests/helpers/fixtures';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('POST /api/documents', () => {
  let app: any;
  const API_KEY = 'test-key';

  beforeAll(async () => {
    process.env.API_KEY = API_KEY;
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('successful upload', () => {
    it('should upload PDF and return document ID', async () => {
      const pdfBuffer = await readFixture(FIXTURES.pdf.digital);

      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'X-API-Key': API_KEY,
        },
        payload: createMultipartPayload('test.pdf', pdfBuffer, 'application/pdf'),
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(body.id).toBeDefined();
      expect(body.filename).toBe('test.pdf');
      expect(body.status).toBe('PENDING');
      expect(body.format).toBe('pdf');
      expect(body.lane).toBe('heavy');
    });

    it('should upload JSON to fast lane', async () => {
      const jsonBuffer = await readFixture(FIXTURES.json.valid);

      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'X-API-Key': API_KEY,
        },
        payload: createMultipartPayload('data.json', jsonBuffer, 'application/json'),
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(body.format).toBe('json');
      expect(body.lane).toBe('fast');
    });

    it('should upload TXT file', async () => {
      const txtBuffer = await readFixture(FIXTURES.text.normal);

      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'X-API-Key': API_KEY,
        },
        payload: createMultipartPayload('readme.txt', txtBuffer, 'text/plain'),
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().format).toBe('txt');
    });

    it('should upload MD file', async () => {
      const mdBuffer = await readFixture(FIXTURES.markdown.withHeaders);

      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'X-API-Key': API_KEY,
        },
        payload: createMultipartPayload('notes.md', mdBuffer, 'text/markdown'),
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().format).toBe('md');
    });

    it('should store document in database', async () => {
      const pdfBuffer = await readFixture(FIXTURES.pdf.digital);

      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
        payload: createMultipartPayload('test.pdf', pdfBuffer, 'application/pdf'),
      });

      const body = response.json();
      const prisma = getPrisma();
      const doc = await prisma.document.findUnique({
        where: { id: body.id },
      });

      expect(doc).not.toBeNull();
      expect(doc?.filename).toBe('test.pdf');
      expect(doc?.md5Hash).toBeDefined();
    });
  });

  describe('validation errors', () => {
    it('should reject unsupported file format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
        payload: createMultipartPayload('image.png', Buffer.from('fake'), 'image/png'),
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('INVALID_FORMAT');
    });

    it('should reject file exceeding size limit', async () => {
      const largeBuffer = Buffer.alloc(51 * 1024 * 1024); // 51MB

      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
        payload: createMultipartPayload('large.pdf', largeBuffer, 'application/pdf'),
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('FILE_TOO_LARGE');
    });

    it('should reject duplicate file (same MD5)', async () => {
      const pdfBuffer = await readFixture(FIXTURES.pdf.digital);

      // First upload
      await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
        payload: createMultipartPayload('test.pdf', pdfBuffer, 'application/pdf'),
      });

      // Second upload (same file)
      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
        payload: createMultipartPayload('test2.pdf', pdfBuffer, 'application/pdf'),
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().error).toBe('DUPLICATE_FILE');
    });
  });

  describe('authentication', () => {
    it('should reject request without API key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: createMultipartPayload('test.pdf', Buffer.from('test'), 'application/pdf'),
      });

      expect(response.statusCode).toBe(401);
    });
  });
});

// Helper to create multipart payload
function createMultipartPayload(filename: string, buffer: Buffer, mimeType: string): string {
  const boundary = '---test';
  const content = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    `Content-Type: ${mimeType}`,
    '',
    buffer.toString('binary'),
    `--${boundary}--`,
  ].join('\r\n');

  return content;
}
