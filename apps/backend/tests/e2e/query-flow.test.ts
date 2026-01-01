import { getTestApp, setupE2E, teardownE2E } from '@tests/e2e/setup/e2e-setup.js';
import { cleanDatabase, ensureDefaultProfile, getPrisma, seedDocument } from '@tests/helpers/database.js';
import { FIXTURES, readFixture } from '@tests/helpers/fixtures.js';
import { mockEmbedding, mockEmbeddingClient } from '@tests/mocks/embedding-mock.js';
import { successCallback } from '@tests/mocks/python-worker-mock.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Mock EmbeddingClient before importing modules that use it
mockEmbeddingClient();

/**
 * E2E: Query Flow Tests
 *
 * NOTE: These tests are SKIPPED because search now requires Qdrant (Phase 5).
 * Qdrant is not available in the E2E test environment.
 *
 * The search route returns 503 SEARCH_UNAVAILABLE when Qdrant is not configured.
 * To test search functionality end-to-end, run manual tests with a real Qdrant instance.
 */
describe.skip('E2E: Query Flow (Requires Qdrant)', () => {
  beforeAll(async () => {
    await setupE2E();
  }, 120000);

  afterAll(async () => {
    await teardownE2E();
  });

  beforeEach(async () => {
    await cleanDatabase();
    await ensureDefaultProfile();
  });

  describe('Vector Search', () => {
    it('should return relevant results for semantic query', async () => {
      const app = getTestApp();

      // Create and process document
      const pdfBuffer = await readFixture(FIXTURES.pdf.digital);

      const uploadResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'Content-Type': 'multipart/form-data; boundary=---e2e',
        },
        payload: createMultipartPayload('ml-doc.pdf', pdfBuffer, 'application/pdf'),
      });

      expect(uploadResponse.statusCode).toBe(201);
      const { id: documentId } = uploadResponse.json();

      // Simulate callback with ML content
      await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: successCallback(documentId, {
          markdown: `# Machine Learning Guide

## Introduction to Machine Learning

Machine learning is a subset of artificial intelligence that enables
systems to learn and improve from experience without being explicitly
programmed.`,
          pageCount: 1,
          ocrApplied: false,
          processingTimeMs: 300,
        }),
      });

      // Query for relevant content
      const queryResponse = await app.inject({
        method: 'POST',
        url: '/api/query',
        payload: {
          query: 'what are the types of machine learning',
          topK: 5,
        },
      });

      expect(queryResponse.statusCode).toBe(200);
      const results = queryResponse.json().results;
      expect(results.length).toBeGreaterThan(0);
    }, 120000);
  });
});

/**
 * E2E tests that verify Qdrant unavailability behavior
 */
describe('E2E: Query Flow (Qdrant unavailable)', () => {
  beforeAll(async () => {
    await setupE2E();
  }, 120000);

  afterAll(async () => {
    await teardownE2E();
  });

  beforeEach(async () => {
    await cleanDatabase();
    await ensureDefaultProfile();
  });

  it('should return 503 when Qdrant is not configured', async () => {
    const app = getTestApp();

    const queryResponse = await app.inject({
      method: 'POST',
      url: '/api/query',
      payload: { query: 'any query', topK: 5 },
    });

    expect(queryResponse.statusCode).toBe(503);
    expect(queryResponse.json().error).toBe('SEARCH_UNAVAILABLE');
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
