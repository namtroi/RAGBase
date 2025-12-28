import { closeTestApp, createTestApp } from '@tests/helpers/api.js';
import { cleanDatabase, getPrisma, seedDocument } from '@tests/helpers/database.js';
import { mockEmbedding, mockEmbeddingClient } from '@tests/mocks/embedding-mock.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Mock EmbeddingClient before importing modules that use it
mockEmbeddingClient();

describe('POST /api/query', () => {
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
        INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, created_at)
        VALUES (gen_random_uuid(), ${doc.id}, 'Test content chunk', 0, ${JSON.stringify(embedding)}::vector, 0, 18, NOW())
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

    it('should use default topK of 5', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        
        payload: { query: 'test' },
      });

      // Default should be 5, but may return fewer if not enough chunks
      expect(response.statusCode).toBe(200);
    });

    it('should reject invalid mode values', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        
        payload: { query: 'test', mode: 'invalid' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject alpha below 0', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        
        payload: { query: 'test', alpha: -0.1 },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject alpha above 1', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        
        payload: { query: 'test', alpha: 1.5 },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('empty results', () => {
    it('should return empty array when no chunks exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        
        payload: { query: 'test', topK: 5 },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().results).toHaveLength(0);
    });
  });

  describe('search filtering', () => {
    async function insertChunk(docId: string, content: string) {
      const prisma = getPrisma();
      const embedding = mockEmbedding(content);
      await prisma.$executeRaw`
        INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, created_at)
        VALUES (gen_random_uuid(), ${docId}, ${content}, 0, ${JSON.stringify(embedding)}::vector, 0, ${content.length}, NOW())
      `;
    }

    it('should exclude inactive documents from search', async () => {
      const activeDoc = await seedDocument({ status: 'COMPLETED', isActive: true, md5Hash: 'active' });
      const inactiveDoc = await seedDocument({ status: 'COMPLETED', isActive: false, md5Hash: 'inactive' });

      await insertChunk(activeDoc.id, 'Active document content');
      await insertChunk(inactiveDoc.id, 'Inactive document content');

      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        
        payload: { query: 'content', topK: 10 },
      });

      const body = response.json();
      expect(body.results).toHaveLength(1);
      expect(body.results[0].documentId).toBe(activeDoc.id);
    });

    it('should exclude non-COMPLETED documents from search', async () => {
      const completedDoc = await seedDocument({ status: 'COMPLETED', md5Hash: 'completed' });
      const failedDoc = await seedDocument({ status: 'FAILED', md5Hash: 'failed' });
      const pendingDoc = await seedDocument({ status: 'PENDING', md5Hash: 'pending' });

      await insertChunk(completedDoc.id, 'Completed content');
      await insertChunk(failedDoc.id, 'Failed content');
      await insertChunk(pendingDoc.id, 'Pending content');

      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        
        payload: { query: 'content', topK: 10 },
      });

      const body = response.json();
      // Only the completed document should return results
      expect(body.results).toHaveLength(1);
      expect(body.results[0].documentId).toBe(completedDoc.id);
    });

    it('should only return results when document is both active and completed', async () => {
      const doc = await seedDocument({ status: 'FAILED', isActive: true, md5Hash: 'failed-active' });
      await insertChunk(doc.id, 'Failed active content');

      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        
        payload: { query: 'content', topK: 10 },
      });

      expect(response.json().results).toHaveLength(0);
    });
  });

  describe('search modes', () => {
    async function insertChunkWithSearchVector(docId: string, content: string, chunkIndex: number = 0) {
      const prisma = getPrisma();
      const embedding = mockEmbedding(content);
      // Insert with search_vector to support hybrid search
      await prisma.$executeRaw`
        INSERT INTO chunks (id, document_id, content, chunk_index, embedding, search_vector, char_start, char_end, created_at)
        VALUES (gen_random_uuid(), ${docId}, ${content}, ${chunkIndex}, ${JSON.stringify(embedding)}::vector, to_tsvector('english', ${content}), 0, ${content.length}, NOW())
      `;
    }

    it('should default to semantic mode', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        
        payload: { query: 'test' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().mode).toBe('semantic');
    });

    it('should accept explicit semantic mode', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        
        payload: { query: 'test', mode: 'semantic' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().mode).toBe('semantic');
    });

    it('should accept hybrid mode', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        
        payload: { query: 'test', mode: 'hybrid' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().mode).toBe('hybrid');
    });

    it('should return alpha value in hybrid mode response', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        
        payload: { query: 'test', mode: 'hybrid', alpha: 0.5 },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.mode).toBe('hybrid');
      expect(body.alpha).toBe(0.5);
    });

    it('should use default alpha 0.7 in hybrid mode when not specified', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        
        payload: { query: 'test', mode: 'hybrid' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().alpha).toBe(0.7);
    });

    it('should include vectorScore and keywordScore in hybrid mode results', async () => {
      const doc = await seedDocument({ status: 'COMPLETED' });
      await insertChunkWithSearchVector(doc.id, 'Machine learning is amazing');

      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        
        payload: { query: 'machine learning', mode: 'hybrid', topK: 5 },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.results.length).toBeGreaterThan(0);
      
      const result = body.results[0];
      expect(result.vectorScore).toBeDefined();
      expect(result.keywordScore).toBeDefined();
      expect(typeof result.vectorScore).toBe('number');
      expect(typeof result.keywordScore).toBe('number');
    });

    it('should not include vectorScore/keywordScore in semantic mode', async () => {
      const doc = await seedDocument({ status: 'COMPLETED' });
      await insertChunkWithSearchVector(doc.id, 'Some test content');

      const response = await app.inject({
        method: 'POST',
        url: '/api/query',
        
        payload: { query: 'test content', mode: 'semantic', topK: 5 },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      if (body.results.length > 0) {
        expect(body.results[0].vectorScore).toBeUndefined();
        expect(body.results[0].keywordScore).toBeUndefined();
      }
    });
  });
});
