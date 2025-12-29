import { closeTestApp, createTestApp } from '@tests/helpers/api.js';
import { cleanDatabase, seedChunk, seedDocument } from '@tests/helpers/database.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('GET /api/documents/:id', () => {
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

  describe('successful retrieval', () => {
    it('should return document status for PENDING document', async () => {
      const doc = await seedDocument({ status: 'PENDING' });

      const response = await app.inject({
        method: 'GET',
        url: `/api/documents/${doc.id}`,
        
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.id).toBe(doc.id);
      expect(body.filename).toBe(doc.filename);
      expect(body.status).toBe('PENDING');
      expect(body.retryCount).toBe(0);
      expect(body.createdAt).toBeDefined();
      expect(body.updatedAt).toBeDefined();
    });

    it('should return PROCESSING status', async () => {
      const doc = await seedDocument({ status: 'PROCESSING' });

      const response = await app.inject({
        method: 'GET',
        url: `/api/documents/${doc.id}`,
        
      });

      expect(response.json().status).toBe('PROCESSING');
    });

    it('should include chunkCount for COMPLETED document', async () => {
      const doc = await seedDocument({ status: 'COMPLETED' });

      // Add chunks
      await Promise.all([
        seedChunk(doc.id, { content: 'Chunk 1', chunkIndex: 0 }),
        seedChunk(doc.id, { content: 'Chunk 2', chunkIndex: 1 }),
      ]);

      const response = await app.inject({
        method: 'GET',
        url: `/api/documents/${doc.id}`,
        
      });

      const body = response.json();
      expect(body.status).toBe('COMPLETED');
      expect(body.chunkCount).toBe(2);
    });

    it('should include failReason for FAILED document', async () => {
      const doc = await seedDocument({
        status: 'FAILED',
        failReason: 'PASSWORD_PROTECTED',
        retryCount: 3,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/documents/${doc.id}`,
        
      });

      const body = response.json();
      expect(body.status).toBe('FAILED');
      expect(body.failReason).toBe('PASSWORD_PROTECTED');
      expect(body.retryCount).toBe(3);
    });
  });

  describe('error cases', () => {
    it('should return 404 for non-existent document', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents/00000000-0000-0000-0000-000000000000',
        
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error).toBe('NOT_FOUND');
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents/invalid-id',
        
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
