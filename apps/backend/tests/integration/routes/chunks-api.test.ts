import { closeTestApp, createTestApp } from '@tests/helpers/api.js';
import { cleanDatabase, getPrisma, seedDocument } from '@tests/helpers/database.js';
import { Prisma } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('Chunks Explorer API', () => {
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

  // Helper to create chunks with specific attributes
  async function seedChunk(documentId: string, overrides: Record<string, unknown> = {}) {
    const prisma = getPrisma();
    const chunkIndex = overrides.chunkIndex ?? 0;
    const content = overrides.content ?? 'Test chunk content';
    const qualityScore = overrides.qualityScore ?? 0.85;
    const chunkType = overrides.chunkType ?? 'document';
    const qualityFlags = overrides.qualityFlags ?? [];

    // Build vector string outside of template
    const vectorStr = `[${Array(384).fill(0.1).join(',')}]`;

    const result = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO chunks (id, document_id, content, chunk_index, embedding, quality_score, chunk_type, quality_flags, created_at)
      VALUES (gen_random_uuid(), ${documentId}, ${content as string}, ${chunkIndex as number}, ${Prisma.sql`${vectorStr}::vector`}, ${qualityScore as number}, ${chunkType as string}, ${qualityFlags as string[]}, NOW())
      RETURNING id
    `;
    return result[0];
  }

  describe('GET /api/chunks', () => {
    it('should return paginated chunks list', async () => {
      const doc = await seedDocument({ status: 'COMPLETED', md5Hash: `chunk-doc-${++docCounter}` });
      await seedChunk(doc.id, { chunkIndex: 0 });
      await seedChunk(doc.id, { chunkIndex: 1 });

      const response = await app.inject({
        method: 'GET',
        url: '/api/chunks',
        
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.chunks).toHaveLength(2);
      expect(data.pagination).toBeDefined();
    });

    it('should return default 20 items per page', async () => {
      const doc = await seedDocument({ status: 'COMPLETED', md5Hash: `chunk-doc-${++docCounter}` });
      for (let i = 0; i < 25; i++) {
        await seedChunk(doc.id, { chunkIndex: i });
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/chunks',
        
      });

      const data = JSON.parse(response.body);
      expect(data.chunks).toHaveLength(20);
      expect(data.pagination.limit).toBe(20);
    });

    it('should filter by documentId', async () => {
      const doc1 = await seedDocument({ status: 'COMPLETED', md5Hash: `chunk-doc-${++docCounter}` });
      const doc2 = await seedDocument({ status: 'COMPLETED', md5Hash: `chunk-doc-${++docCounter}` });
      await seedChunk(doc1.id, { chunkIndex: 0 });
      await seedChunk(doc2.id, { chunkIndex: 0 });

      const response = await app.inject({
        method: 'GET',
        url: `/api/chunks?documentId=${doc1.id}`,
        
      });

      const data = JSON.parse(response.body);
      expect(data.chunks).toHaveLength(1);
      expect(data.chunks[0].documentId).toBe(doc1.id);
    });

    it('should filter by quality excellent (>=0.85)', async () => {
      const doc = await seedDocument({ status: 'COMPLETED', md5Hash: `chunk-doc-${++docCounter}` });
      await seedChunk(doc.id, { chunkIndex: 0, qualityScore: 0.90 });
      await seedChunk(doc.id, { chunkIndex: 1, qualityScore: 0.70 });

      const response = await app.inject({
        method: 'GET',
        url: '/api/chunks?quality=excellent',
        
      });

      const data = JSON.parse(response.body);
      expect(data.chunks).toHaveLength(1);
      expect(data.chunks[0].qualityScore).toBeGreaterThanOrEqual(0.85);
    });

    it('should filter by quality good (0.70-0.84)', async () => {
      const doc = await seedDocument({ status: 'COMPLETED', md5Hash: `chunk-doc-${++docCounter}` });
      await seedChunk(doc.id, { chunkIndex: 0, qualityScore: 0.75 });
      await seedChunk(doc.id, { chunkIndex: 1, qualityScore: 0.90 });
      await seedChunk(doc.id, { chunkIndex: 2, qualityScore: 0.50 });

      const response = await app.inject({
        method: 'GET',
        url: '/api/chunks?quality=good',
        
      });

      const data = JSON.parse(response.body);
      expect(data.chunks).toHaveLength(1);
      expect(data.chunks[0].qualityScore).toBeGreaterThanOrEqual(0.70);
      expect(data.chunks[0].qualityScore).toBeLessThan(0.85);
    });

    it('should filter by quality low (<0.70)', async () => {
      const doc = await seedDocument({ status: 'COMPLETED', md5Hash: `chunk-doc-${++docCounter}` });
      await seedChunk(doc.id, { chunkIndex: 0, qualityScore: 0.50 });
      await seedChunk(doc.id, { chunkIndex: 1, qualityScore: 0.85 });

      const response = await app.inject({
        method: 'GET',
        url: '/api/chunks?quality=low',
        
      });

      const data = JSON.parse(response.body);
      expect(data.chunks).toHaveLength(1);
      expect(data.chunks[0].qualityScore).toBeLessThan(0.70);
    });

    it('should filter by chunk type document', async () => {
      const doc = await seedDocument({ status: 'COMPLETED', md5Hash: `chunk-doc-${++docCounter}` });
      await seedChunk(doc.id, { chunkIndex: 0, chunkType: 'document' });
      await seedChunk(doc.id, { chunkIndex: 1, chunkType: 'tabular' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/chunks?type=document',
        
      });

      const data = JSON.parse(response.body);
      expect(data.chunks).toHaveLength(1);
      expect(data.chunks[0].chunkType).toBe('document');
    });

    it('should filter by chunk type tabular', async () => {
      const doc = await seedDocument({ status: 'COMPLETED', md5Hash: `chunk-doc-${++docCounter}` });
      await seedChunk(doc.id, { chunkIndex: 0, chunkType: 'tabular' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/chunks?type=tabular',
        
      });

      const data = JSON.parse(response.body);
      expect(data.chunks).toHaveLength(1);
      expect(data.chunks[0].chunkType).toBe('tabular');
    });

    it('should search content by keyword', async () => {
      const doc = await seedDocument({ status: 'COMPLETED', md5Hash: `chunk-doc-${++docCounter}` });
      await seedChunk(doc.id, { chunkIndex: 0, content: 'The quick brown fox' });
      await seedChunk(doc.id, { chunkIndex: 1, content: 'Lazy dog sleeping' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/chunks?search=fox',
        
      });

      const data = JSON.parse(response.body);
      expect(data.chunks).toHaveLength(1);
      expect(data.chunks[0].content).toContain('fox');
    });

    it('should return total count for pagination', async () => {
      const doc = await seedDocument({ status: 'COMPLETED', md5Hash: `chunk-doc-${++docCounter}` });
      for (let i = 0; i < 50; i++) {
        await seedChunk(doc.id, { chunkIndex: i });
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/chunks?limit=10',
        
      });

      const data = JSON.parse(response.body);
      expect(data.pagination.total).toBe(50);
      expect(data.pagination.totalPages).toBe(5);
    });
  });

  describe('GET /api/chunks/:id', () => {
    it('should return chunk detail by id', async () => {
      const doc = await seedDocument({ status: 'COMPLETED', md5Hash: `chunk-doc-${++docCounter}` });
      const chunk = await seedChunk(doc.id, {
        chunkIndex: 0,
        content: 'Full content here',
        qualityScore: 0.88,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/chunks/${chunk.id}`,
        
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.id).toBe(chunk.id);
      expect(data.content).toBe('Full content here');
      expect(data.qualityScore).toBe(0.88);
    });

    it('should include all metadata in chunk detail', async () => {
      const doc = await seedDocument({ status: 'COMPLETED', md5Hash: `chunk-doc-${++docCounter}` });
      const chunk = await seedChunk(doc.id, { chunkIndex: 0 });

      const response = await app.inject({
        method: 'GET',
        url: `/api/chunks/${chunk.id}`,
        
      });

      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('documentId');
      expect(data).toHaveProperty('document');
      expect(data).toHaveProperty('content');
      expect(data).toHaveProperty('qualityScore');
      expect(data).toHaveProperty('chunkType');
      expect(data).toHaveProperty('createdAt');
    });

    it('should return 404 for non-existent chunk', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/chunks/00000000-0000-0000-0000-000000000000',
        
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('NOT_FOUND');
    });
  });
});
