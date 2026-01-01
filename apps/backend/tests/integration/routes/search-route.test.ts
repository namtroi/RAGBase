import { closeTestApp, createTestApp } from '@tests/helpers/api.js';
import { cleanDatabase, getPrisma, seedDocument } from '@tests/helpers/database.js';
import { mockEmbedding, mockEmbeddingClient } from '@tests/mocks/embedding-mock.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Mock EmbeddingClient before importing modules that use it
mockEmbeddingClient();

/**
 * Search Route Integration Tests
 *
 * NOTE: These tests are SKIPPED because search now requires Qdrant (Phase 5).
 * Qdrant is not available in the test environment (uses testcontainers for Postgres only).
 *
 * The search route returns 503 SEARCH_UNAVAILABLE when Qdrant is not configured.
 * To test search functionality, use E2E tests with a real Qdrant instance.
 */
describe.skip('POST /api/query (Requires Qdrant)', () => {
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

  describe('successful queries', () => {
    it('should return similar chunks', async () => {
      // Create document with chunks
      const doc = await seedDocument({ status: 'COMPLETED' });
      const prisma = getPrisma();

      // Insert chunks with embeddings (using raw SQL for pgvector)
      const embedding = mockEmbedding('test content');

      await prisma.$executeRaw`
        INSERT INTO chunks (id, document_id, content, chunk_index, embedding, created_at)
        VALUES (gen_random_uuid(), ${doc.id}, 'Test content chunk', 0, ${JSON.stringify(embedding)}::vector, NOW())
      `;

      const response = await app.inject({
        method: 'POST',
        url: '/api/query',

        payload: { query: 'test content', topK: 5 },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.results).toBeInstanceOf(Array);
      expect(body.results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('validation errors', () => {
    it('should reject empty query', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/query',

        payload: { query: '' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject query exceeding 1000 chars', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/query',

        payload: { query: 'a'.repeat(1001) },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});

/**
 * These tests verify search unavailability when Qdrant is not configured.
 */
describe('POST /api/query (Qdrant unavailable)', () => {
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

  it('should return 503 when Qdrant is not configured', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/query',
      payload: { query: 'test' },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error).toBe('SEARCH_UNAVAILABLE');
  });

  it('should still validate input before checking Qdrant', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/query',
      payload: { query: '' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('VALIDATION_ERROR');
  });

  it('should reject invalid mode values', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/query',
      payload: { query: 'test', mode: 'invalid' },
    });

    expect(response.statusCode).toBe(400);
  });



  it('should reject query exceeding 1000 chars', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/query',
      payload: { query: 'a'.repeat(1001) },
    });

    expect(response.statusCode).toBe(400);
  });
});
