/**
 * Delete Route Integration Tests
 */

import { closeTestApp, createTestApp } from '@tests/helpers/api.js';
import { cleanDatabase, seedChunk, seedDocument } from '@tests/helpers/database.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Delete Route', () => {
  let app: any;
  
  const TEST_UPLOAD_DIR = join(tmpdir(), 'ragbase-test-delete');

  beforeAll(async () => {
    
    // Create test upload directory
    mkdirSync(TEST_UPLOAD_DIR, { recursive: true });
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('DELETE /api/documents/:id', () => {
    it('should delete document and chunks', async () => {
      const doc = await seedDocument({ status: 'COMPLETED' });
      await seedChunk(doc.id, { chunkIndex: 0 });
      await seedChunk(doc.id, { chunkIndex: 1 });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/documents/${doc.id}`,
        
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.id).toBe(doc.id);
      expect(body.deleted).toBe(true);

      // Verify document is gone
      const checkResponse = await app.inject({
        method: 'GET',
        url: `/api/documents/${doc.id}`,
        
      });
      expect(checkResponse.statusCode).toBe(404);
    });

    it('should delete PENDING document', async () => {
      const doc = await seedDocument({ status: 'PENDING' });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/documents/${doc.id}`,
        
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().deleted).toBe(true);
    });

    it('should delete FAILED document', async () => {
      const doc = await seedDocument({ status: 'FAILED' });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/documents/${doc.id}`,
        
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().deleted).toBe(true);
    });

    it('should return 404 for non-existent document', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/documents/550e8400-e29b-41d4-a716-446655440000',
        
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error).toBe('NOT_FOUND');
    });

    it('should return 409 for PROCESSING document', async () => {
      const doc = await seedDocument({ status: 'PROCESSING' });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/documents/${doc.id}`,
        
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().error).toBe('CONFLICT');
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/documents/not-a-uuid',
        
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('INVALID_ID');
    });
  });

  describe('POST /api/documents/bulk/delete', () => {
    it('should delete multiple documents', async () => {
      const doc1 = await seedDocument({ status: 'COMPLETED', md5Hash: 'h1' });
      const doc2 = await seedDocument({ status: 'COMPLETED', md5Hash: 'h2' });
      await seedChunk(doc1.id, { chunkIndex: 0 });
      await seedChunk(doc2.id, { chunkIndex: 0 });

      const response = await app.inject({
        method: 'POST',
        url: '/api/documents/bulk/delete',
        
        payload: { documentIds: [doc1.id, doc2.id] },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.deleted).toBe(2);
      expect(body.failed).toHaveLength(0);
    });

    it('should skip PROCESSING documents and return partial success', async () => {
      const completed = await seedDocument({ status: 'COMPLETED', md5Hash: 'h1' });
      const processing = await seedDocument({ status: 'PROCESSING', md5Hash: 'h2' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/documents/bulk/delete',
        
        payload: { documentIds: [completed.id, processing.id] },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.deleted).toBe(1);
      expect(body.failed).toHaveLength(1);
      expect(body.failed[0].id).toBe(processing.id);
      expect(body.failed[0].reason).toContain('processing');
    });

    it('should handle non-existent documents in bulk', async () => {
      const doc = await seedDocument({ status: 'COMPLETED' });
      const nonExistentId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await app.inject({
        method: 'POST',
        url: '/api/documents/bulk/delete',
        
        payload: { documentIds: [doc.id, nonExistentId] },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.deleted).toBe(1);
      expect(body.failed).toHaveLength(1);
      expect(body.failed[0].id).toBe(nonExistentId);
      expect(body.failed[0].reason).toBe('Document not found');
    });

    it('should return 400 for empty documentIds array', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/documents/bulk/delete',
        
        payload: { documentIds: [] },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid UUIDs in array', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/documents/bulk/delete',
        
        payload: { documentIds: ['not-a-uuid'] },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('VALIDATION_ERROR');
    });
  });
});
