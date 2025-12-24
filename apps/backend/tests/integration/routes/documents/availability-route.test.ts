/**
 * Availability Route Integration Tests
 */

import { closeTestApp, createTestApp } from '@tests/helpers/api.js';
import { cleanDatabase, seedDocument } from '@tests/helpers/database.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('Availability Route', () => {
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

  describe('PATCH /api/documents/:id/availability', () => {
    it('should toggle COMPLETED document to inactive', async () => {
      const doc = await seedDocument({ status: 'COMPLETED', isActive: true });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/documents/${doc.id}/availability`,
        headers: { 'X-API-Key': API_KEY },
        payload: { isActive: false },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.id).toBe(doc.id);
      expect(body.isActive).toBe(false);
      expect(body.updatedAt).toBeDefined();
    });

    it('should toggle inactive document to active', async () => {
      const doc = await seedDocument({ status: 'COMPLETED', isActive: false });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/documents/${doc.id}/availability`,
        headers: { 'X-API-Key': API_KEY },
        payload: { isActive: true },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().isActive).toBe(true);
    });

    it('should return 400 for PENDING document', async () => {
      const doc = await seedDocument({ status: 'PENDING' });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/documents/${doc.id}/availability`,
        headers: { 'X-API-Key': API_KEY },
        payload: { isActive: false },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('INVALID_STATUS');
    });

    it('should return 400 for PROCESSING document', async () => {
      const doc = await seedDocument({ status: 'PROCESSING' });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/documents/${doc.id}/availability`,
        headers: { 'X-API-Key': API_KEY },
        payload: { isActive: false },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('INVALID_STATUS');
    });

    it('should return 400 for FAILED document', async () => {
      const doc = await seedDocument({ status: 'FAILED' });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/documents/${doc.id}/availability`,
        headers: { 'X-API-Key': API_KEY },
        payload: { isActive: false },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('INVALID_STATUS');
    });

    it('should return 404 for non-existent document', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/documents/550e8400-e29b-41d4-a716-446655440000/availability',
        headers: { 'X-API-Key': API_KEY },
        payload: { isActive: false },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error).toBe('NOT_FOUND');
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/documents/not-a-uuid/availability',
        headers: { 'X-API-Key': API_KEY },
        payload: { isActive: false },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('INVALID_ID');
    });

    it('should return 400 for invalid body', async () => {
      const doc = await seedDocument({ status: 'COMPLETED' });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/documents/${doc.id}/availability`,
        headers: { 'X-API-Key': API_KEY },
        payload: { isActive: 'not-boolean' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /api/documents/bulk/availability', () => {
    it('should toggle multiple COMPLETED documents', async () => {
      const doc1 = await seedDocument({ status: 'COMPLETED', md5Hash: 'h1', isActive: true });
      const doc2 = await seedDocument({ status: 'COMPLETED', md5Hash: 'h2', isActive: true });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/documents/bulk/availability',
        headers: { 'X-API-Key': API_KEY },
        payload: { documentIds: [doc1.id, doc2.id], isActive: false },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.updated).toBe(2);
      expect(body.failed).toHaveLength(0);
    });

    it('should skip non-COMPLETED documents and return partial success', async () => {
      const completed = await seedDocument({ status: 'COMPLETED', md5Hash: 'h1' });
      const pending = await seedDocument({ status: 'PENDING', md5Hash: 'h2' });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/documents/bulk/availability',
        headers: { 'X-API-Key': API_KEY },
        payload: { documentIds: [completed.id, pending.id], isActive: false },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.updated).toBe(1);
      expect(body.failed).toHaveLength(1);
      expect(body.failed[0].id).toBe(pending.id);
      expect(body.failed[0].reason).toContain('PENDING');
    });

    it('should handle non-existent documents in bulk', async () => {
      const doc = await seedDocument({ status: 'COMPLETED' });
      const nonExistentId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/documents/bulk/availability',
        headers: { 'X-API-Key': API_KEY },
        payload: { documentIds: [doc.id, nonExistentId], isActive: false },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.updated).toBe(1);
      expect(body.failed).toHaveLength(1);
      expect(body.failed[0].id).toBe(nonExistentId);
      expect(body.failed[0].reason).toBe('Document not found');
    });

    it('should return 400 for empty documentIds array', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/documents/bulk/availability',
        headers: { 'X-API-Key': API_KEY },
        payload: { documentIds: [], isActive: false },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid UUIDs in array', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/documents/bulk/availability',
        headers: { 'X-API-Key': API_KEY },
        payload: { documentIds: ['not-a-uuid'], isActive: false },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('VALIDATION_ERROR');
    });
  });
});
