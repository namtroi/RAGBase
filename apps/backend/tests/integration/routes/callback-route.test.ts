import { closeTestApp, createTestApp } from '@tests/helpers/api.js';
import { cleanDatabase, getPrisma, seedDocument } from '@tests/helpers/database.js';
import { ERRORS, successCallback } from '@tests/mocks/python-worker-mock.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('POST /internal/callback', () => {
  let app: any;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('successful callback', () => {
    it('should update document to COMPLETED', async () => {
      const doc = await seedDocument({ status: 'PROCESSING' });

      const response = await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: successCallback(doc.id, {
          markdown: '# Test Document\n\nThis is enough content to pass the quality gate validation check.',
          pageCount: 1,
          ocrApplied: false,
          processingTimeMs: 150,
        }),
      });

      expect(response.statusCode).toBe(200);

      const prisma = getPrisma();
      const updated = await prisma.document.findUnique({
        where: { id: doc.id },
      });

      expect(updated?.status).toBe('COMPLETED');
    });

    it('should create chunks from markdown', async () => {
      const doc = await seedDocument({ status: 'PROCESSING' });

      await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: successCallback(doc.id, {
          markdown: '# Title\n\nFirst paragraph with enough content to be a valid chunk. '.repeat(20),
          pageCount: 1,
          ocrApplied: false,
          processingTimeMs: 100,
        }),
      });

      const prisma = getPrisma();
      const chunks = await prisma.chunk.findMany({
        where: { documentId: doc.id },
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should generate embeddings for chunks', async () => {
      const doc = await seedDocument({ status: 'PROCESSING' });

      await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: successCallback(doc.id, {
          markdown: '# Test\n\nContent that will be embedded for vector search capabilities.',
          pageCount: 1,
          ocrApplied: false,
          processingTimeMs: 100,
        }),
      });

      // Verify embeddings exist (checking via raw query)
      const prisma = getPrisma();
      const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM chunks
        WHERE document_id = ${doc.id}
        AND embedding IS NOT NULL
      `;

      expect(Number(result[0].count)).toBeGreaterThan(0);
    });
  });

  describe('failure callback', () => {
    it('should update document to FAILED with reason', async () => {
      const doc = await seedDocument({ status: 'PROCESSING' });

      const response = await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: ERRORS.passwordProtected(doc.id),
      });

      expect(response.statusCode).toBe(200);

      const prisma = getPrisma();
      const updated = await prisma.document.findUnique({
        where: { id: doc.id },
      });

      expect(updated?.status).toBe('FAILED');
      expect(updated?.failReason).toBe('PASSWORD_PROTECTED');
    });

    it('should handle corrupt file error', async () => {
      const doc = await seedDocument({ status: 'PROCESSING' });

      await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: ERRORS.corrupt(doc.id),
      });

      const prisma = getPrisma();
      const updated = await prisma.document.findUnique({
        where: { id: doc.id },
      });

      expect(updated?.failReason).toBe('CORRUPT_FILE');
    });

    it('should handle timeout error', async () => {
      const doc = await seedDocument({ status: 'PROCESSING' });

      await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: ERRORS.timeout(doc.id),
      });

      const prisma = getPrisma();
      const updated = await prisma.document.findUnique({
        where: { id: doc.id },
      });

      expect(updated?.failReason).toBe('TIMEOUT');
    });
  });

  describe('validation', () => {
    it('should reject invalid documentId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: {
          documentId: 'not-a-uuid',
          success: true,
          result: {
            markdown: '# Test',
            pageCount: 1,
            ocrApplied: false,
            processingTimeMs: 100,
          },
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject callback for non-existent document', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: successCallback('00000000-0000-0000-0000-000000000000'),
      });

      expect(response.statusCode).toBe(404);
    });

    it('should not require API key (internal route)', async () => {
      const doc = await seedDocument({ status: 'PROCESSING' });

      const response = await app.inject({
        method: 'POST',
        url: '/internal/callback',
        // No X-API-Key header
        payload: successCallback(doc.id),
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('quality gate', () => {
    it('should reject low quality content', async () => {
      const doc = await seedDocument({ status: 'PROCESSING' });

      const response = await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: successCallback(doc.id, {
          markdown: 'Too short', // < 50 chars
          pageCount: 1,
          ocrApplied: false,
          processingTimeMs: 100,
        }),
      });

      expect(response.statusCode).toBe(200);

      const prisma = getPrisma();
      const updated = await prisma.document.findUnique({
        where: { id: doc.id },
      });

      expect(updated?.status).toBe('FAILED');
      expect(updated?.failReason).toContain('TEXT_TOO_SHORT');
    });
  });
});
