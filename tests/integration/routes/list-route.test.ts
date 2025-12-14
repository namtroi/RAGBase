import { closeTestApp, createTestApp } from '@tests/helpers/api';
import { cleanDatabase, seedDocument } from '@tests/helpers/database';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('GET /api/documents', () => {
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

  describe('list documents', () => {
    it('should return empty list when no documents', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().documents).toHaveLength(0);
      expect(response.json().total).toBe(0);
    });

    it('should return all documents', async () => {
      await seedDocument({ filename: 'doc1.pdf' });
      await seedDocument({ filename: 'doc2.pdf', md5Hash: 'hash2' });
      await seedDocument({ filename: 'doc3.pdf', md5Hash: 'hash3' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().documents).toHaveLength(3);
      expect(response.json().total).toBe(3);
    });

    it('should include document summary fields', async () => {
      await seedDocument({ filename: 'test.pdf', status: 'COMPLETED' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
      });

      const doc = response.json().documents[0];
      expect(doc.id).toBeDefined();
      expect(doc.filename).toBe('test.pdf');
      expect(doc.status).toBe('COMPLETED');
      expect(doc.createdAt).toBeDefined();
    });
  });

  describe('filtering', () => {
    it('should filter by status', async () => {
      await seedDocument({ status: 'PENDING', md5Hash: 'h1' });
      await seedDocument({ status: 'COMPLETED', md5Hash: 'h2' });
      await seedDocument({ status: 'FAILED', md5Hash: 'h3' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/documents?status=COMPLETED',
        headers: { 'X-API-Key': API_KEY },
      });

      expect(response.json().documents).toHaveLength(1);
      expect(response.json().documents[0].status).toBe('COMPLETED');
    });
  });

  describe('pagination', () => {
    it('should respect limit parameter', async () => {
      for (let i = 0; i < 30; i++) {
        await seedDocument({ md5Hash: `hash${i}` });
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/documents?limit=10',
        headers: { 'X-API-Key': API_KEY },
      });

      expect(response.json().documents).toHaveLength(10);
      expect(response.json().total).toBe(30);
    });

    it('should respect offset parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await seedDocument({ filename: `doc${i}.pdf`, md5Hash: `hash${i}` });
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/documents?limit=5&offset=5',
        headers: { 'X-API-Key': API_KEY },
      });

      expect(response.json().documents).toHaveLength(5);
    });

    it('should use default limit of 20', async () => {
      for (let i = 0; i < 30; i++) {
        await seedDocument({ md5Hash: `hash${i}` });
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/documents',
        headers: { 'X-API-Key': API_KEY },
      });

      expect(response.json().documents).toHaveLength(20);
    });
  });
});
