import { closeTestApp, createTestApp } from '@tests/helpers/api.js';
import { cleanDatabase, getPrisma } from '@tests/helpers/database.js';
import { FIXTURES, readFixture } from '@tests/helpers/fixtures.js';
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

      const { payload, headers } = createMultipartMock('test.pdf', pdfBuffer, 'application/pdf');

      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'X-API-Key': API_KEY,
          ...headers,
        },
        payload,
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(body.id).toBeDefined();
      expect(body.filename).toBe('test.pdf');
      expect(body.status).toBe('PENDING');
      expect(body.format).toBe('pdf');
    });

    it('should upload JSON', async () => {
      const jsonBuffer = await readFixture(FIXTURES.json.valid);

      const { payload, headers } = createMultipartMock('data.json', jsonBuffer, 'application/json');

      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'X-API-Key': API_KEY,
          ...headers,
        },
        payload,
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(body.format).toBe('json');
    });

    it('should upload TXT file', async () => {
      const txtBuffer = await readFixture(FIXTURES.text.normal);

      const { payload, headers } = createMultipartMock('readme.txt', txtBuffer, 'text/plain');

      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'X-API-Key': API_KEY,
          ...headers,
        },
        payload,
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().format).toBe('txt');
    });

    it('should upload MD file', async () => {
      const mdBuffer = await readFixture(FIXTURES.markdown.withHeaders);

      const { payload, headers } = createMultipartMock('notes.md', mdBuffer, 'text/markdown');

      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'X-API-Key': API_KEY,
          ...headers,
        },
        payload,
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().format).toBe('md');
    });

    it('should store document in database', async () => {
      const pdfBuffer = await readFixture(FIXTURES.pdf.digital);

      const { payload, headers } = createMultipartMock('test.pdf', pdfBuffer, 'application/pdf');

      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY, ...headers },
        payload,
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
      const { payload, headers } = createMultipartMock('image.png', Buffer.from('fake'), 'image/png');

      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY, ...headers },
        payload,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('INVALID_FORMAT');
    });

    it('should reject file exceeding size limit', async () => {
      const largeBuffer = Buffer.alloc(51 * 1024 * 1024); // 51MB

      const { payload, headers } = createMultipartMock('large.pdf', largeBuffer, 'application/pdf');

      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY, ...headers },
        payload,
      });

      expect(response.statusCode).toBe(413);
      expect(response.json().error).toBe('INTERNAL_ERROR'); // Fastify default for too large
    });

    it('should reject duplicate file (same MD5)', async () => {
      const pdfBuffer = await readFixture(FIXTURES.pdf.digital);

      const req1 = createMultipartMock('test.pdf', pdfBuffer, 'application/pdf');

      // First upload
      await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY, ...req1.headers },
        payload: req1.payload,
      });

      const req2 = createMultipartMock('test2.pdf', pdfBuffer, 'application/pdf');

      // Second upload (same file)
      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY, ...req2.headers },
        payload: req2.payload,
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().error).toBe('DUPLICATE_FILE');
    });
  });

  describe('authentication', () => {
    it('should reject request without API key', async () => {
      const { payload, headers } = createMultipartMock('test.pdf', Buffer.from('test'), 'application/pdf');

      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers,
        payload,
      });

      expect(response.statusCode).toBe(401);
    });
  });
});

// Helper to create multipart payload
function createMultipartMock(filename: string, buffer: Buffer, mimeType: string) {
  const boundary = 'ragbase_test_boundary';

  const headers = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    `Content-Type: ${mimeType}`,
    '',
    '',
  ].join('\r\n');

  const footer = `\r\n--${boundary}--\r\n`;

  const payload = Buffer.concat([
    Buffer.from(headers),
    buffer,
    Buffer.from(footer),
  ]);

  return {
    payload,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
  };
}


