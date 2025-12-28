import { closeTestApp, createTestApp } from '@tests/helpers/api.js';
import { cleanDatabase, getPrisma, seedDocument } from '@tests/helpers/database.js';
import { Prisma } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('Analytics API', () => {
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
        
      });

      const data = JSON.parse(response.body);
      expect(data.avgQualityScore).toBe(0.85);
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
        
      });

      const data = JSON.parse(response.body);
      expect(data.documents[0].metrics.totalTimeMs).toBe(1500);
    });

    it('should include quality scores per document', async () => {
      await seedDocumentWithMetrics({ avgQualityScore: 0.92 });

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/documents',
        
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
        
      });

      const data = JSON.parse(response.body);
      expect(data.chunks[0].index).toBe(0);
      expect(data.chunks[1].index).toBe(1);
    });

    it('should return 404 for non-existent document', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/documents/00000000-0000-0000-0000-000000000000/chunks',
        
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ============================================================
  // Phase 1 TDD: New Analytics Metrics Tests
  // ============================================================

  describe('GET /api/analytics/overview - New Metrics', () => {
    it('should return success rate percentage', async () => {
      const prisma = getPrisma();
      // 2 completed, 1 failed = 66.67% success rate
      await seedDocumentWithMetrics();
      await seedDocumentWithMetrics();
      await prisma.document.create({
        data: {
          filename: 'failed.pdf',
          mimeType: 'application/pdf',
          fileSize: 1024,
          format: 'pdf',
          status: 'FAILED',
          filePath: '/tmp/failed.pdf',
          md5Hash: `failed-${Date.now()}`,
          failReason: 'TEST_FAILURE',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/overview',
        
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.successRate).toBeDefined();
      expect(data.successRate).toBeCloseTo(66.67, 1);
    });

    it('should return format distribution', async () => {
      const prisma = getPrisma();
      // 2 PDF, 1 DOCX
      await seedDocumentWithMetrics();
      await seedDocumentWithMetrics();
      await prisma.document.create({
        data: {
          filename: 'test.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          fileSize: 1024,
          format: 'docx',
          status: 'COMPLETED',
          filePath: '/tmp/test.docx',
          md5Hash: `docx-${Date.now()}`,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/overview',
        
      });

      const data = JSON.parse(response.body);
      expect(data.formatDistribution).toBeDefined();
      expect(data.formatDistribution.pdf).toBe(2);
      expect(data.formatDistribution.docx).toBe(1);
    });

    it('should return average user wait time', async () => {
      await seedDocumentWithMetrics({ userWaitTimeMs: 5000 });
      await seedDocumentWithMetrics({ userWaitTimeMs: 3000 });

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/overview',
        
      });

      const data = JSON.parse(response.body);
      expect(data.avgUserWaitTimeMs).toBe(4000);
    });
  });

  describe('GET /api/analytics/processing - Format Filter & New Metrics', () => {
    it('should filter by format=pdf', async () => {
      const prisma = getPrisma();
      // Create PDF doc with metrics
      await seedDocumentWithMetrics({ totalTimeMs: 1000 });
      // Create DOCX doc (no metrics since seedDocumentWithMetrics uses pdf)
      await prisma.document.create({
        data: {
          filename: 'test.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          fileSize: 1024,
          format: 'docx',
          status: 'COMPLETED',
          filePath: '/tmp/test.docx',
          md5Hash: `docx-filter-${Date.now()}`,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/processing?format=pdf',
        
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.documentsProcessed).toBe(1);
    });

    it('should return OCR usage percentage for PDF', async () => {
      // 1 with OCR, 1 without = 50%
      await seedDocumentWithMetrics({ ocrApplied: true });
      await seedDocumentWithMetrics({ ocrApplied: false });

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/processing?format=pdf',
        
      });

      const data = JSON.parse(response.body);
      expect(data.ocrUsagePercent).toBeDefined();
      expect(data.ocrUsagePercent).toBe(50);
    });

    it('should return average conversion time per page', async () => {
      // 500ms conversion, 5 pages = 100ms/page
      await seedDocumentWithMetrics({ conversionTimeMs: 500, pageCount: 5 });

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/processing?format=pdf',
        
      });

      const data = JSON.parse(response.body);
      expect(data.avgConversionTimePerPage).toBeDefined();
      expect(data.avgConversionTimePerPage).toBe(100);
    });
  });

  describe('GET /api/analytics/quality - Rate Calculations', () => {
    it('should return fragment rate percentage', async () => {
      // 5 fragments out of 20 chunks = 25%
      await seedDocumentWithMetrics({
        qualityFlags: { FRAGMENT: 5 },
        totalChunks: 20,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/quality',
        
      });

      const data = JSON.parse(response.body);
      expect(data.fragmentRate).toBeDefined();
      expect(data.fragmentRate).toBe(25);
    });

    it('should return no context rate percentage', async () => {
      // 10 no_context out of 50 chunks = 20%
      await seedDocumentWithMetrics({
        qualityFlags: { NO_CONTEXT: 10 },
        totalChunks: 50,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/quality',
        
      });

      const data = JSON.parse(response.body);
      expect(data.noContextRate).toBeDefined();
      expect(data.noContextRate).toBe(20);
    });

    it('should return too short rate percentage', async () => {
      // 3 too_short out of 30 chunks = 10%
      await seedDocumentWithMetrics({
        qualityFlags: { TOO_SHORT: 3 },
        totalChunks: 30,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/quality',
        
      });

      const data = JSON.parse(response.body);
      expect(data.tooShortRate).toBeDefined();
      expect(data.tooShortRate).toBe(10);
    });

    it('should return context injection rate', async () => {
      const prisma = getPrisma();
      const doc = await seedDocumentWithMetrics({ totalChunks: 4 });

      // Create 4 chunks: 2 with breadcrumbs, 2 without = 50%
      const vectorStr = `[${Array(384).fill(0.1).join(',')}]`;
      await prisma.$executeRaw`
        INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, breadcrumbs, created_at)
        VALUES (gen_random_uuid(), ${doc.id}, 'Chunk 1', 0, ${Prisma.sql`${vectorStr}::vector`}, 0, 100, ARRAY['Heading 1'], NOW())
      `;
      await prisma.$executeRaw`
        INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, breadcrumbs, created_at)
        VALUES (gen_random_uuid(), ${doc.id}, 'Chunk 2', 1, ${Prisma.sql`${vectorStr}::vector`}, 100, 200, ARRAY['Heading 1', 'Heading 2'], NOW())
      `;
      await prisma.$executeRaw`
        INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, breadcrumbs, created_at)
        VALUES (gen_random_uuid(), ${doc.id}, 'Chunk 3', 2, ${Prisma.sql`${vectorStr}::vector`}, 200, 300, ARRAY[]::text[], NOW())
      `;
      await prisma.$executeRaw`
        INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, breadcrumbs, created_at)
        VALUES (gen_random_uuid(), ${doc.id}, 'Chunk 4', 3, ${Prisma.sql`${vectorStr}::vector`}, 300, 400, ARRAY[]::text[], NOW())
      `;

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/quality',
        
      });

      const data = JSON.parse(response.body);
      expect(data.contextInjectionRate).toBeDefined();
      expect(data.contextInjectionRate).toBe(50);
    });

    it('should return avg tokens per chunk', async () => {
      // 1000 tokens / 10 chunks = 100 tokens/chunk
      await seedDocumentWithMetrics({ totalTokens: 1000, totalChunks: 10 });

      const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/quality',
        
      });

      const data = JSON.parse(response.body);
      expect(data.avgTokensPerChunk).toBeDefined();
      expect(data.avgTokensPerChunk).toBe(100);
    });
  });
});
