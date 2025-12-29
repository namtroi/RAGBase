import { API_KEY, getTestApp, setupE2E, teardownE2E } from '@tests/e2e/setup/e2e-setup.js';
import { cleanDatabase, ensureDefaultProfile, getPrisma, seedDocument } from '@tests/helpers/database.js';
import { FIXTURES, readFixture } from '@tests/helpers/fixtures.js';
import { mockEmbedding, mockEmbeddingClient } from '@tests/mocks/embedding-mock.js';
import { successCallback } from '@tests/mocks/python-worker-mock.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Mock EmbeddingClient before importing modules that use it
mockEmbeddingClient();

describe('E2E: Query Flow', () => {
  beforeAll(async () => {
    await setupE2E();
  }, 120000);

  afterAll(async () => {
    await teardownE2E();
  });

  beforeEach(async () => {
    await cleanDatabase();
    await ensureDefaultProfile();
  });

  describe('Vector Search', () => {
    it('should return relevant results for semantic query', async () => {
      const app = getTestApp();

      // Create and process document
      const pdfBuffer = await readFixture(FIXTURES.pdf.digital);

      const uploadResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'multipart/form-data; boundary=---e2e',
        },
        payload: createMultipartPayload('ml-doc.pdf', pdfBuffer, 'application/pdf'),
      });

      expect(uploadResponse.statusCode).toBe(201);
      const { id: documentId } = uploadResponse.json();

      // Simulate callback with ML content
      await app.inject({
        method: 'POST',
        url: '/internal/callback',
        payload: successCallback(documentId, {
          markdown: `# Machine Learning Guide

## Introduction to Machine Learning

Machine learning is a subset of artificial intelligence that enables
systems to learn and improve from experience without being explicitly
programmed. It focuses on developing algorithms that can access data
and use it to learn for themselves.

## Types of Machine Learning

### Supervised Learning
Supervised learning uses labeled datasets to train algorithms to
classify data or predict outcomes accurately.

### Unsupervised Learning
Unsupervised learning uses unlabeled data to discover patterns
and relationships in data without predetermined outcomes.

### Reinforcement Learning
Reinforcement learning trains agents to make decisions by rewarding
desired behaviors and punishing undesired ones.`,
          pageCount: 1,
          ocrApplied: false,
          processingTimeMs: 300,
        }),
      });

      // Query for relevant content
      const queryResponse = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: {
          query: 'what are the types of machine learning',
          topK: 5,
        },
      });

      expect(queryResponse.statusCode).toBe(200);

      const results = queryResponse.json().results;
      expect(results.length).toBeGreaterThan(0);

      // Results should be from our document
      expect(results[0].documentId).toBe(documentId);

      // Results should have valid scores (0-1 range)
      expect(results[0].score).toBeGreaterThanOrEqual(0);
      expect(results[0].score).toBeLessThanOrEqual(1);
    }, 120000);

    it('should respect topK limit', async () => {
      const app = getTestApp();
      const prisma = getPrisma();

      // Create document with many chunks
      const doc = await seedDocument({ status: 'COMPLETED' });

      // Insert 20 chunks
      for (let i = 0; i < 20; i++) {
        const embedding = mockEmbedding(`chunk ${i} content`);
        const embeddingStr = `[${embedding.join(',')}]`;
        await prisma.$executeRaw`
          INSERT INTO chunks (id, document_id, content, chunk_index, embedding, created_at)
          VALUES (gen_random_uuid(), ${doc.id}, ${`Chunk ${i} with searchable content`}, ${i}, ${embeddingStr}::vector, NOW())
        `;
      }

      // Query with topK=5
      const queryResponse = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: { query: 'searchable content', topK: 5 },
      });

      expect(queryResponse.statusCode).toBe(200);
      expect(queryResponse.json().results).toHaveLength(5);
    }, 30000);

    it('should return results ordered by similarity', async () => {
      const app = getTestApp();
      const prisma = getPrisma();

      const doc = await seedDocument({ status: 'COMPLETED' });

      // Insert chunks with varying similarity to query
      const contents = [
        'machine learning algorithms',
        'deep learning neural networks',
        'cooking recipes and tips',
        'machine learning models',
      ];

      for (let i = 0; i < contents.length; i++) {
        const embedding = mockEmbedding(contents[i]);
        const embeddingStr = `[${embedding.join(',')}]`;
        await prisma.$executeRaw`
          INSERT INTO chunks (id, document_id, content, chunk_index, embedding, created_at)
          VALUES (gen_random_uuid(), ${doc.id}, ${contents[i]}, ${i}, ${embeddingStr}::vector, NOW())
        `;
      }

      const queryResponse = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: { query: 'machine learning', topK: 4 },
      });

      expect(queryResponse.statusCode).toBe(200);
      const results = queryResponse.json().results;

      // Results should be sorted by score descending
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    }, 30000);

    it('should include metadata in results', async () => {
      const app = getTestApp();
      const prisma = getPrisma();

      const doc = await seedDocument({ status: 'COMPLETED' });

      const embedding = mockEmbedding('test content');
      const embeddingStr = `[${embedding.join(',')}]`;
      await prisma.$executeRaw`
        INSERT INTO chunks (id, document_id, content, chunk_index, embedding, page, heading, created_at)
        VALUES (gen_random_uuid(), ${doc.id}, 'Test content for metadata check', 0, ${embeddingStr}::vector, 5, 'Chapter 1', NOW())
      `;

      const queryResponse = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: { query: 'test content', topK: 1 },
      });

      expect(queryResponse.statusCode).toBe(200);
      const result = queryResponse.json().results[0];

      expect(result.metadata).toBeDefined();
      expect(result.metadata.page).toBe(5);
      expect(result.metadata.heading).toBe('Chapter 1');
    }, 30000);

    it('should return empty array when no chunks exist', async () => {
      const app = getTestApp();

      const queryResponse = await app.inject({
        method: 'POST',
        url: '/api/query',
        headers: { 'X-API-Key': API_KEY },
        payload: { query: 'any query', topK: 5 },
      });

      expect(queryResponse.statusCode).toBe(200);
      expect(queryResponse.json().results).toHaveLength(0);
    });
  });
});

function createMultipartPayload(filename: string, buffer: Buffer, mimeType: string): Buffer {
  const boundary = '---e2e';
  const parts: Buffer[] = [];

  // Opening boundary
  parts.push(Buffer.from(`--${boundary}\r\n`));

  // Content-Disposition and Content-Type headers
  parts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`));
  parts.push(Buffer.from(`Content-Type: ${mimeType}\r\n\r\n`));

  // File content
  parts.push(buffer);

  // Closing boundary
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  return Buffer.concat(parts);
}
