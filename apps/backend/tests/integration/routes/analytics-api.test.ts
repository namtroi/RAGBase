import { closeTestApp, createTestApp } from '@tests/helpers/api.js';
import { cleanDatabase, getPrisma, seedDocument } from '@tests/helpers/database.js';
import { Prisma } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('Analytics API', () => {
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

  // Counter for unique hashes
  let docCounter = 0;

  // Helper to create a document with ProcessingMetrics
  async function seedDocumentWithMetrics(overrides: Record<string, unknown> = {}) {
    const prisma = getPrisma();
    docCounter++;
    const doc = await seedDocument({ status: 'COMPLETED', md5Hash: `metrics-hash-${docCounter}-${Date.now()}` });
    
    await prisma.processingMetrics.create({
      data: {
        documentId: doc.id,
        pageCount: 5,
        ocrApplied: false,
        conversionTimeMs: 500,
        chunkingTimeMs: 200,
        embeddingTimeMs: 300,
        totalTimeMs: 1000,
        queueTimeMs: 100,
        userWaitTimeMs: 1100,
        rawSizeBytes: 2048,
        markdownSizeChars: 1500,
        totalChunks: 10,
        avgChunkSize: 150,
        oversizedChunks: 1,
        avgQualityScore: 0.85,
        qualityFlags: { TOO_SHORT: 2 },
        totalTokens: 500,
        ...overrides,
      },
    });
    
    return doc;
  }

  describe('GET /api/analytics/overview', () => {
    it('should return total documents count', async () => {
      await seedDocumentWithMetrics();
      await seedDocumentWithMetrics();

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/overview',
        headers: { 'X-API-Key': API_KEY },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.totalDocuments).toBe(2);
    });

    it('should return average processing time', async () => {
      await seedDocumentWithMetrics({ totalTimeMs: 1000 });
      await seedDocumentWithMetrics({ totalTimeMs: 2000 });

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/overview',
        headers: { 'X-API-Key': API_KEY },
      });

      const data = JSON.parse(response.body);
      expect(data.avgProcessingTimeMs).toBe(1500);
    });

    it('should return average quality score', async () => {
      await seedDocumentWithMetrics({ avgQualityScore: 0.8 });
      await seedDocumentWithMetrics({ avgQualityScore: 0.9 });

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/overview',
        headers: { 'X-API-Key': API_KEY },
      });

      const data = JSON.parse(response.body);
      expect(data.avgQualityScore).toBe(0.85);
    });

    it('should filter by period 24h', async () => {
      await seedDocumentWithMetrics();

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/overview?period=24h',
        headers: { 'X-API-Key': API_KEY },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.period).toBe('24h');
    });

    it('should filter by period 7d', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/overview?period=7d',
        headers: { 'X-API-Key': API_KEY },
      });

      const data = JSON.parse(response.body);
      expect(data.period).toBe('7d');
    });

    it('should filter by period 30d', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/overview?period=30d',
        headers: { 'X-API-Key': API_KEY },
      });

      const data = JSON.parse(response.body);
      expect(data.period).toBe('30d');
    });
  });

  describe('GET /api/analytics/processing', () => {
    it('should return time breakdown by stage', async () => {
      await seedDocumentWithMetrics({
        conversionTimeMs: 500,
        chunkingTimeMs: 200,
        embeddingTimeMs: 300,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/processing',
        headers: { 'X-API-Key': API_KEY },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.breakdown.avgConversionTimeMs).toBe(500);
      expect(data.breakdown.avgChunkingTimeMs).toBe(200);
      expect(data.breakdown.avgEmbeddingTimeMs).toBe(300);
    });

    it('should return queue time separately', async () => {
      await seedDocumentWithMetrics({ queueTimeMs: 500 });

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/processing',
        headers: { 'X-API-Key': API_KEY },
      });

      const data = JSON.parse(response.body);
      expect(data.breakdown.avgQueueTimeMs).toBe(500);
    });

    it('should return document count', async () => {
      await seedDocumentWithMetrics();
      await seedDocumentWithMetrics();

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/processing',
        headers: { 'X-API-Key': API_KEY },
      });

      const data = JSON.parse(response.body);
      expect(data.documentsProcessed).toBe(2);
    });
  });

  describe('GET /api/analytics/quality', () => {
    it('should return average quality score', async () => {
      await seedDocumentWithMetrics({ avgQualityScore: 0.75 });

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/quality',
        headers: { 'X-API-Key': API_KEY },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.avgQualityScore).toBeDefined();
    });

    it('should return quality flags breakdown', async () => {
      await seedDocumentWithMetrics({ 
        qualityFlags: { TOO_SHORT: 5, NO_CONTEXT: 3 } 
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/quality',
        headers: { 'X-API-Key': API_KEY },
      });

      const data = JSON.parse(response.body);
      expect(data.flags).toHaveProperty('TOO_SHORT');
      expect(data.flags.TOO_SHORT).toBe(5);
    });
  });

  describe('GET /api/analytics/documents', () => {
    it('should return paginated document metrics', async () => {
      await seedDocumentWithMetrics();
      await seedDocumentWithMetrics();

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/documents',
        headers: { 'X-API-Key': API_KEY },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.documents).toHaveLength(2);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBe(2);
    });

    it('should include processing times per document', async () => {
      await seedDocumentWithMetrics({ totalTimeMs: 1500 });

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/documents',
        headers: { 'X-API-Key': API_KEY },
      });

      const data = JSON.parse(response.body);
      expect(data.documents[0].metrics.totalTimeMs).toBe(1500);
    });

    it('should include quality scores per document', async () => {
      await seedDocumentWithMetrics({ avgQualityScore: 0.92 });

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/documents',
        headers: { 'X-API-Key': API_KEY },
      });

      const data = JSON.parse(response.body);
      expect(data.documents[0].metrics.avgQualityScore).toBe(0.92);
    });

    it('should support pagination', async () => {
      await seedDocumentWithMetrics();
      await seedDocumentWithMetrics();
      await seedDocumentWithMetrics();

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/documents?page=1&limit=2',
        headers: { 'X-API-Key': API_KEY },
      });

      const data = JSON.parse(response.body);
      expect(data.documents).toHaveLength(2);
      expect(data.pagination.totalPages).toBe(2);
    });
  });

  describe('GET /api/analytics/documents/:id/chunks', () => {
    it('should return chunks for specific document', async () => {
      const prisma = getPrisma();
      const doc = await seedDocumentWithMetrics();
      
      // Create test chunks with proper vector syntax
      const vectorStr = `[${Array(384).fill(0.1).join(',')}]`;
      await prisma.$executeRaw`
        INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, created_at)
        VALUES (gen_random_uuid(), ${doc.id}, 'Test chunk 1', 0, ${Prisma.sql`${vectorStr}::vector`}, 0, 100, NOW())
      `;
      await prisma.$executeRaw`
        INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, created_at)
        VALUES (gen_random_uuid(), ${doc.id}, 'Test chunk 2', 1, ${Prisma.sql`${vectorStr}::vector`}, 100, 200, NOW())
      `;

      const response = await app.inject({
        method: 'GET',
        url: `/api/analytics/documents/${doc.id}/chunks`,
        headers: { 'X-API-Key': API_KEY },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.chunks).toHaveLength(2);
      expect(data.documentId).toBe(doc.id);
    });

    it('should order chunks by index', async () => {
      const prisma = getPrisma();
      const doc = await seedDocumentWithMetrics();
      
      // Insert out of order with proper vector syntax
      const vectorStr = `[${Array(384).fill(0.1).join(',')}]`;
      await prisma.$executeRaw`
        INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, created_at)
        VALUES (gen_random_uuid(), ${doc.id}, 'Chunk B', 1, ${Prisma.sql`${vectorStr}::vector`}, 100, 200, NOW())
      `;
      await prisma.$executeRaw`
        INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, created_at)
        VALUES (gen_random_uuid(), ${doc.id}, 'Chunk A', 0, ${Prisma.sql`${vectorStr}::vector`}, 0, 100, NOW())
      `;

      const response = await app.inject({
        method: 'GET',
        url: `/api/analytics/documents/${doc.id}/chunks`,
        headers: { 'X-API-Key': API_KEY },
      });

      const data = JSON.parse(response.body);
      expect(data.chunks[0].index).toBe(0);
      expect(data.chunks[1].index).toBe(1);
    });

    it('should return 404 for non-existent document', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/documents/00000000-0000-0000-0000-000000000000/chunks',
        headers: { 'X-API-Key': API_KEY },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
