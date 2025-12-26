import { closeTestApp, createTestApp } from '@tests/helpers/api.js';
import { cleanDatabase, getPrisma, seedDocument } from '@tests/helpers/database.js';
import { successCallback } from '@tests/mocks/python-worker-mock.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const API_KEY = 'test-api-key';

describe('Analytics E2E Flow', () => {
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

    describe('ProcessingMetrics creation', () => {
        it('should create ProcessingMetrics when document is processed via callback', async () => {
            const doc = await seedDocument({ status: 'PROCESSING', md5Hash: `e2e-test-${Date.now()}-1` });

            // Simulate successful callback with metrics
            await app.inject({
                method: 'POST',
                url: '/internal/callback',
                payload: successCallback(doc.id, {
                    processedContent: '# E2E Test Document\n\nThis is test content for the analytics E2E test.',
                    chunks: [{
                        content: 'Test chunk content for analytics',
                        index: 0,
                        embedding: Array(384).fill(0.1),
                        metadata: { charStart: 0, charEnd: 50, qualityScore: 0.85 }
                    }],
                    pageCount: 1,
                    ocrApplied: false,
                    processingTimeMs: 1500,
                    metrics: {
                        startedAt: new Date().toISOString(),
                        completedAt: new Date().toISOString(),
                        conversionTimeMs: 500,
                        chunkingTimeMs: 300,
                        embeddingTimeMs: 400,
                        totalTimeMs: 1200,
                        rawSizeBytes: 2048,
                        markdownSizeChars: 1024,
                        totalChunks: 1,
                        avgChunkSize: 1024,
                        oversizedChunks: 0,
                        avgQualityScore: 0.85,
                        qualityFlags: {},
                        totalTokens: 150,
                    },
                }),
            });

            // Verify ProcessingMetrics was created
            const prisma = getPrisma();
            const metrics = await prisma.processingMetrics.findUnique({
                where: { documentId: doc.id },
            });

            expect(metrics).not.toBeNull();
            expect(metrics?.conversionTimeMs).toBe(500);
            expect(metrics?.chunkingTimeMs).toBe(300);
            expect(metrics?.embeddingTimeMs).toBe(400);
            expect(metrics?.totalTimeMs).toBe(1200);
            expect(metrics?.avgQualityScore).toBe(0.85);
        });
    });

    describe('Analytics Overview reflects new documents', () => {
        it('should show processed document in analytics overview', async () => {
            // Create and process a document
            const doc = await seedDocument({ status: 'PROCESSING', md5Hash: `e2e-test-${Date.now()}-2` });

            await app.inject({
                method: 'POST',
                url: '/internal/callback',
                payload: successCallback(doc.id, {
                    processedContent: '# Analytics Overview Test\n\nContent for testing overview endpoint.',
                    chunks: [{
                        content: 'Test chunk',
                        index: 0,
                        embedding: Array(384).fill(0.1),
                    }],
                    pageCount: 1,
                    ocrApplied: false,
                    processingTimeMs: 1000,
                    metrics: {
                        totalTimeMs: 1000,
                        avgQualityScore: 0.80,
                        totalChunks: 1,
                    },
                }),
            });

            // Fetch analytics overview
            const response = await app.inject({
                method: 'GET',
                url: '/api/analytics/overview?period=all',
                headers: { 'X-API-Key': API_KEY },
            });

            expect(response.statusCode).toBe(200);
            const data = JSON.parse(response.body);
            expect(data.totalDocuments).toBeGreaterThanOrEqual(1);
            expect(data.totalChunks).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Chunks Explorer after processing', () => {
        it('should return paginated chunks list after document processing', async () => {
            const doc = await seedDocument({ status: 'PROCESSING', md5Hash: `e2e-test-${Date.now()}-3` });

            await app.inject({
                method: 'POST',
                url: '/internal/callback',
                payload: successCallback(doc.id, {
                    processedContent: '# Chunks Explorer Test\n\nContent for chunks explorer.',
                    chunks: [
                        {
                            content: 'High quality chunk with excellent score',
                            index: 0,
                            embedding: Array(384).fill(0.1),
                            metadata: { qualityScore: 0.90, qualityFlags: [] }
                        },
                        {
                            content: 'Low quality chunk',
                            index: 1,
                            embedding: Array(384).fill(0.1),
                            metadata: { qualityScore: 0.60, qualityFlags: ['TOO_SHORT'] }
                        },
                    ],
                    pageCount: 1,
                    ocrApplied: false,
                    processingTimeMs: 800,
                    metrics: { totalChunks: 2 },
                }),
            });

            // Fetch all chunks - verify API structure works
            const response = await app.inject({
                method: 'GET',
                url: '/api/chunks?limit=50',
                headers: { 'X-API-Key': API_KEY },
            });

            expect(response.statusCode).toBe(200);
            const data = JSON.parse(response.body);
            // Verify API returns proper structure
            expect(data.chunks).toBeDefined();
            expect(Array.isArray(data.chunks)).toBe(true);
            expect(data.pagination).toBeDefined();
            expect(typeof data.pagination.total).toBe('number');
        });

        it('should filter chunks by quality correctly', async () => {
            const doc = await seedDocument({ status: 'PROCESSING', md5Hash: `e2e-test-${Date.now()}-4` });

            await app.inject({
                method: 'POST',
                url: '/internal/callback',
                payload: successCallback(doc.id, {
                    processedContent: '# Quality Filter Test\n\nTest quality filtering.',
                    chunks: [
                        {
                            content: 'Excellent quality chunk with high score for testing',
                            index: 0,
                            embedding: Array(384).fill(0.1),
                            metadata: { qualityScore: 0.92, qualityFlags: [] }
                        },
                        {
                            content: 'Low quality',
                            index: 1,
                            embedding: Array(384).fill(0.1),
                            metadata: { qualityScore: 0.50, qualityFlags: ['TOO_SHORT'] }
                        },
                    ],
                    pageCount: 1,
                    ocrApplied: false,
                    processingTimeMs: 500,
                }),
            });

            // Filter by excellent quality
            const excellentResponse = await app.inject({
                method: 'GET',
                url: '/api/chunks?quality=excellent',
                headers: { 'X-API-Key': API_KEY },
            });

            expect(excellentResponse.statusCode).toBe(200);
            const excellentData = JSON.parse(excellentResponse.body);

            // All returned chunks should have score >= 0.85
            for (const chunk of excellentData.chunks) {
                expect(chunk.qualityScore).toBeGreaterThanOrEqual(0.85);
            }

            // Filter by low quality
            const lowResponse = await app.inject({
                method: 'GET',
                url: '/api/chunks?quality=low',
                headers: { 'X-API-Key': API_KEY },
            });

            expect(lowResponse.statusCode).toBe(200);
            const lowData = JSON.parse(lowResponse.body);

            // All returned chunks should have score < 0.70
            for (const chunk of lowData.chunks) {
                expect(chunk.qualityScore).toBeLessThan(0.70);
            }
        });
    });

    describe('Processing endpoint reflects metrics', () => {
        it('should return processing time breakdown', async () => {
            const doc = await seedDocument({ status: 'PROCESSING', md5Hash: `e2e-test-${Date.now()}-5` });

            await app.inject({
                method: 'POST',
                url: '/internal/callback',
                payload: successCallback(doc.id, {
                    processedContent: '# Processing Time Test\n\nTest processing time breakdown.',
                    chunks: [{
                        content: 'Test chunk',
                        index: 0,
                        embedding: Array(384).fill(0.1),
                    }],
                    pageCount: 1,
                    ocrApplied: false,
                    processingTimeMs: 2000,
                    metrics: {
                        conversionTimeMs: 800,
                        chunkingTimeMs: 400,
                        embeddingTimeMs: 600,
                        totalTimeMs: 1800,
                    },
                }),
            });

            const response = await app.inject({
                method: 'GET',
                url: '/api/analytics/processing?period=all',
                headers: { 'X-API-Key': API_KEY },
            });

            expect(response.statusCode).toBe(200);
            const data = JSON.parse(response.body);

            // Verify structure exists
            expect(data.period).toBeDefined();
            expect(data.breakdown).toBeDefined();
            expect(typeof data.breakdown.avgConversionTimeMs).toBe('number');
            expect(typeof data.breakdown.avgChunkingTimeMs).toBe('number');
            expect(typeof data.breakdown.avgEmbeddingTimeMs).toBe('number');
            expect(typeof data.documentsProcessed).toBe('number');
        });
    });
});
