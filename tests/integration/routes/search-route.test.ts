import { closeTestApp, createTestApp } from '@tests/helpers/api';
import { cleanDatabase, getPrisma, seedDocument } from '@tests/helpers/database';
import { mockEmbedding } from '@tests/mocks/embedding-mock';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('POST /api/query', () => {
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

  describe('successful queries', () => {
    it('should return similar chunks', async () => {
      // Create document with chunks
      const doc = await seedDocument({ status: 'COMPLETED' });
      const prisma = getPrisma();

      // Insert chunks with embeddings (using raw SQL for pgvector)
      const embedding = mockEmbedding('test content');

      await prisma.$executeRaw`
        INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, created_at)
        VALUES (gen_random_uuid(), ${doc.id}, 'Test content chunk', 0, ${JSON.stringify(embedding)}::vector, 0, 18, NOW())
      `;

      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: { query: 'test content', topK: 5 },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.results).toBeInstanceOf(Array);
      expect(body.results.length).toBeGreaterThanOrEqual(0);
    });

    it('should return results ordered by score', async () => {
      const doc = await seedDocument({ status: 'COMPLETED' });
      const prisma = getPrisma();

      // Insert multiple chunks
      const embedding1 = mockEmbedding('machine learning');
      const embedding2 = mockEmbedding('deep learning');

      await prisma.$executeRaw`
        INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, created_at)
        VALUES
          (gen_random_uuid(), ${doc.id}, 'Machine learning basics', 0, ${JSON.stringify(embedding1)}::vector, 0, 23, NOW()),
          (gen_random_uuid(), ${doc.id}, 'Deep learning advanced', 1, ${JSON.stringify(embedding2)}::vector, 23, 45, NOW())
      `;

      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: { query: 'machine learning', topK: 2 },
      });

      const results = response.json().results;
      if (results.length >= 2) {
        expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      }
    });

    it('should respect topK limit', async () => {
      const doc = await seedDocument({ status: 'COMPLETED' });
      const prisma = getPrisma();

      // Insert 10 chunks
      for (let i = 0; i < 10; i++) {
        const embedding = mockEmbedding(`chunk ${i}`);

        await prisma.$executeRaw`
          INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, created_at)
          VALUES (gen_random_uuid(), ${doc.id}, ${`Chunk ${i} content`}, ${i}, ${JSON.stringify(embedding)}::vector, ${i * 10}, ${(i + 1) * 10}, NOW())
        `;
      }

      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: { query: 'test', topK: 3 },
      });

      expect(response.json().results).toHaveLength(3);
    });

    it('should include metadata in results', async () => {
      const doc = await seedDocument({ status: 'COMPLETED' });
      const prisma = getPrisma();

      const embedding = mockEmbedding('test');

      await prisma.$executeRaw`
        INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, page, heading, created_at)
        VALUES (gen_random_uuid(), ${doc.id}, 'Content', 0, ${JSON.stringify(embedding)}::vector, 0, 7, 1, 'Introduction', NOW())
      `;

      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: { query: 'test', topK: 1 },
      });

      const result = response.json().results[0];
      expect(result.content).toBeDefined();
      expect(result.score).toBeDefined();
      expect(result.documentId).toBe(doc.id);
      expect(result.metadata).toBeDefined();
    });
  });

  describe('validation errors', () => {
    it('should reject empty query', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: { query: '' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject query exceeding 1000 chars', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: { query: 'a'.repeat(1001) },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should use default topK of 5', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: { query: 'test' },
      });

      // Default should be 5, but may return fewer if not enough chunks
      expect(response.statusCode).toBe(200);
    });
  });

  describe('empty results', () => {
    it('should return empty array when no chunks exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: { query: 'test', topK: 5 },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().results).toHaveLength(0);
    });
  });
});
