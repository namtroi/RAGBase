import { closeTestApp, createTestApp } from '@tests/helpers/api.js';
import { cleanDatabase, seedDocument } from '@tests/helpers/database.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('GET /api/documents', () => {
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

  describe('list documents', () => {
    it('should return empty list when no documents', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents',
        
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
        
      });

      const doc = response.json().documents[0];
      expect(doc.id).toBeDefined();
      expect(doc.filename).toBe('test.pdf');
      expect(doc.status).toBe('COMPLETED');
      expect(doc.createdAt).toBeDefined();
      expect(doc.isActive).toBeDefined();
      expect(doc.connectionState).toBeDefined();
    });

    it('should include counts in response', async () => {
      await seedDocument({ status: 'PENDING', md5Hash: 'h1' });
      await seedDocument({ status: 'COMPLETED', md5Hash: 'h2', isActive: true });
      await seedDocument({ status: 'FAILED', md5Hash: 'h3', isActive: false });

      const response = await app.inject({
        method: 'GET',
        url: '/api/documents',
        
      });

      const body = response.json();
      expect(body.counts).toBeDefined();
      expect(body.counts.total).toBe(3);
      expect(body.counts.pending).toBe(1);
      expect(body.counts.failed).toBe(1);
      expect(body.counts.completed).toBe(1);
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
        
      });

      expect(response.json().documents).toHaveLength(1);
      expect(response.json().documents[0].status).toBe('COMPLETED');
    });

    it('should filter by isActive', async () => {
      await seedDocument({ isActive: true, md5Hash: 'h1' });
      await seedDocument({ isActive: true, md5Hash: 'h2' });
      await seedDocument({ isActive: false, md5Hash: 'h3' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/documents?isActive=true',
        
      });

      expect(response.json().documents).toHaveLength(2);
      response.json().documents.forEach((doc: any) => {
        expect(doc.isActive).toBe(true);
      });
    });

    it('should filter by connectionState', async () => {
      await seedDocument({ connectionState: 'STANDALONE', md5Hash: 'h1' });
      await seedDocument({ connectionState: 'LINKED', md5Hash: 'h2' });
      await seedDocument({ connectionState: 'LINKED', md5Hash: 'h3' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/documents?connectionState=LINKED',
        
      });

      expect(response.json().documents).toHaveLength(2);
      response.json().documents.forEach((doc: any) => {
        expect(doc.connectionState).toBe('LINKED');
      });
    });

    it('should filter by sourceType', async () => {
      await seedDocument({ sourceType: 'MANUAL', md5Hash: 'h1' });
      await seedDocument({ sourceType: 'DRIVE', md5Hash: 'h2' });
      await seedDocument({ sourceType: 'DRIVE', md5Hash: 'h3' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/documents?sourceType=DRIVE',
        
      });

      expect(response.json().documents).toHaveLength(2);
      response.json().documents.forEach((doc: any) => {
        expect(doc.sourceType).toBe('DRIVE');
      });
    });

    it('should search by filename (case-insensitive)', async () => {
      await seedDocument({ filename: 'Invoice-2024.pdf', md5Hash: 'h1' });
      await seedDocument({ filename: 'invoice_jan.pdf', md5Hash: 'h2' });
      await seedDocument({ filename: 'report.pdf', md5Hash: 'h3' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/documents?search=invoice',
        
      });

      expect(response.json().documents).toHaveLength(2);
    });

    it('should combine multiple filters', async () => {
      await seedDocument({ status: 'COMPLETED', isActive: true, md5Hash: 'h1' });
      await seedDocument({ status: 'COMPLETED', isActive: false, md5Hash: 'h2' });
      await seedDocument({ status: 'FAILED', isActive: true, md5Hash: 'h3' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/documents?status=COMPLETED&isActive=true',
        
      });

      expect(response.json().documents).toHaveLength(1);
      expect(response.json().documents[0].status).toBe('COMPLETED');
      expect(response.json().documents[0].isActive).toBe(true);
    });
  });

  describe('sorting', () => {
    it('should sort by createdAt desc by default', async () => {
      await seedDocument({ filename: 'first.pdf', md5Hash: 'h1' });
      await new Promise(r => setTimeout(r, 10)); // Small delay to ensure different timestamps
      await seedDocument({ filename: 'second.pdf', md5Hash: 'h2' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/documents',
        
      });

      const docs = response.json().documents;
      expect(docs[0].filename).toBe('second.pdf');
      expect(docs[1].filename).toBe('first.pdf');
    });

    it('should sort by createdAt asc', async () => {
      await seedDocument({ filename: 'first.pdf', md5Hash: 'h1' });
      await new Promise(r => setTimeout(r, 10));
      await seedDocument({ filename: 'second.pdf', md5Hash: 'h2' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/documents?sortOrder=asc',
        
      });

      const docs = response.json().documents;
      expect(docs[0].filename).toBe('first.pdf');
      expect(docs[1].filename).toBe('second.pdf');
    });

    it('should sort by filename', async () => {
      await seedDocument({ filename: 'zebra.pdf', md5Hash: 'h1' });
      await seedDocument({ filename: 'apple.pdf', md5Hash: 'h2' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/documents?sortBy=filename&sortOrder=asc',
        
      });

      const docs = response.json().documents;
      expect(docs[0].filename).toBe('apple.pdf');
      expect(docs[1].filename).toBe('zebra.pdf');
    });

    it('should sort by fileSize', async () => {
      await seedDocument({ filename: 'small.pdf', fileSize: 100, md5Hash: 'h1' });
      await seedDocument({ filename: 'large.pdf', fileSize: 10000, md5Hash: 'h2' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/documents?sortBy=fileSize&sortOrder=desc',
        
      });

      const docs = response.json().documents;
      expect(docs[0].filename).toBe('large.pdf');
      expect(docs[1].filename).toBe('small.pdf');
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
        
      });

      expect(response.json().documents).toHaveLength(20);
    });
  });
});
