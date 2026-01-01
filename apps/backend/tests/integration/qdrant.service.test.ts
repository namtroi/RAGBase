/**
 * QdrantService Integration Tests
 *
 * Tests against live Qdrant Cloud instance using env variables.
 * These tests require QDRANT_URL and QDRANT_API_KEY to be set.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { QdrantService, QdrantPoint } from '../../src/services/qdrant.service.js';

// Skip if Qdrant not configured
const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const skipTests = !QDRANT_URL;

// Use a test collection to avoid affecting production data
const TEST_COLLECTION = 'ragbase_test_' + Date.now();

describe.skipIf(skipTests)('QdrantService', () => {
  let service: QdrantService;
  const testDocumentId = randomUUID();
  const testChunkIds: string[] = [];

  beforeAll(async () => {
    service = new QdrantService(QDRANT_URL!, QDRANT_API_KEY, TEST_COLLECTION);
  });

  afterAll(async () => {
    // Cleanup: delete test collection
    try {
      // @ts-ignore - accessing private client for cleanup
      await service.client.deleteCollection(TEST_COLLECTION);
    } catch {
      // Ignore cleanup errors
    }
  });

  test('ensureCollection creates collection if not exists', async () => {
    await expect(service.ensureCollection()).resolves.not.toThrow();
  });

  test('upsertPoints inserts new points', async () => {
    const chunkId = randomUUID();
    testChunkIds.push(chunkId);

    const points: QdrantPoint[] = [
      {
        id: chunkId,
        vector: {
          dense: Array(384).fill(0.1),
          sparse: {
            indices: [100, 200, 300],
            values: [0.5, 0.3, 0.2],
          },
        },
        payload: {
          documentId: testDocumentId,
          content: 'Test chunk content for search.',
          metadata: { page: 1, heading: 'Test Section' },
        },
      },
    ];

    await expect(service.upsertPoints(points)).resolves.not.toThrow();
  });

  test('upsertPoints updates existing points', async () => {
    const chunkId = testChunkIds[0];

    const points: QdrantPoint[] = [
      {
        id: chunkId,
        vector: {
          dense: Array(384).fill(0.2), // Changed vector
          sparse: {
            indices: [100, 200, 300, 400],
            values: [0.6, 0.3, 0.1, 0.1],
          },
        },
        payload: {
          documentId: testDocumentId,
          content: 'Updated chunk content.',
          metadata: { page: 1, heading: 'Updated Section' },
        },
      },
    ];

    await expect(service.upsertPoints(points)).resolves.not.toThrow();
  });

  test('hybridSearch returns results', async () => {
    // Wait for indexing
    await new Promise((r) => setTimeout(r, 500));

    const results = await service.hybridSearch({
      dense: Array(384).fill(0.2),
      sparse: {
        indices: [100, 200],
        values: [0.5, 0.3],
      },
      topK: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('id');
    expect(results[0]).toHaveProperty('score');
    expect(results[0]).toHaveProperty('payload');
    expect(results[0].payload).toHaveProperty('content');
  });

  test('hybridSearch with filter returns filtered results', async () => {
    // Add another document's chunk
    const otherDocId = randomUUID();
    const otherChunkId = randomUUID();

    await service.upsertPoints([
      {
        id: otherChunkId,
        vector: {
          dense: Array(384).fill(0.3),
          sparse: { indices: [500, 600], values: [0.4, 0.4] },
        },
        payload: {
          documentId: otherDocId,
          content: 'Other document content.',
          metadata: {},
        },
      },
    ]);

    await new Promise((r) => setTimeout(r, 500));

    // Search with filter for original document
    const results = await service.hybridSearch({
      dense: Array(384).fill(0.2),
      sparse: { indices: [100], values: [0.5] },
      topK: 10,
      filter: { documentId: testDocumentId },
    });

    // All results should be from the filtered document
    for (const result of results) {
      expect(result.payload.documentId).toBe(testDocumentId);
    }

    // Cleanup other chunk
    await service.deletePoints([otherChunkId]);
  });

  test('deletePoints removes points by ID', async () => {
    const tempChunkId = randomUUID();

    // Insert
    await service.upsertPoints([
      {
        id: tempChunkId,
        vector: {
          dense: Array(384).fill(0.5),
          sparse: { indices: [999], values: [1.0] },
        },
        payload: {
          documentId: randomUUID(),
          content: 'Temporary chunk.',
          metadata: {},
        },
      },
    ]);

    // Delete
    await expect(service.deletePoints([tempChunkId])).resolves.not.toThrow();
  });

  test('deleteByDocumentId removes all chunks for document', async () => {
    const docId = randomUUID();

    // Insert multiple chunks for same document
    await service.upsertPoints([
      {
        id: randomUUID(),
        vector: {
          dense: Array(384).fill(0.1),
          sparse: { indices: [1], values: [1] },
        },
        payload: { documentId: docId, content: 'Chunk 1', metadata: {} },
      },
      {
        id: randomUUID(),
        vector: {
          dense: Array(384).fill(0.2),
          sparse: { indices: [2], values: [1] },
        },
        payload: { documentId: docId, content: 'Chunk 2', metadata: {} },
      },
    ]);

    // Delete all by document
    await expect(service.deleteByDocumentId(docId)).resolves.not.toThrow();
  });

  test('getCollectionInfo returns status', async () => {
    const info = await service.getCollectionInfo();

    expect(info).toHaveProperty('pointsCount');
    expect(info).toHaveProperty('status');
    expect(typeof info.pointsCount).toBe('number');
    expect(info.status).toBe('green');
  });
});
