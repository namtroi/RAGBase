import { closeTestApp, createTestApp } from '@tests/helpers/api.js';
import { cleanDatabase, getPrisma, seedDocument } from '@tests/helpers/database.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('POST /internal/callback - ProcessingMetrics', () => {
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

    const validContent = '# Test\n\nThis is enough content to pass the quality gate validation check which requires at least 50 chars.';

    it('should create ProcessingMetrics record on callback', async () => {
        const doc = await seedDocument({ status: 'PROCESSING' });

        await app.inject({
            method: 'POST',
            url: '/internal/callback',
            payload: {
                documentId: doc.id,
                success: true,
                result: {
                    processedContent: validContent,
                    chunks: [{ content: validContent, index: 0, embedding: Array(384).fill(0.1) }],
                    pageCount: 5,
                    ocrApplied: true,
                    processingTimeMs: 1500,
                    metrics: {
                        startedAt: new Date().toISOString(),
                        completedAt: new Date().toISOString(),
                        conversionTimeMs: 500,
                        chunkingTimeMs: 200,
                        embeddingTimeMs: 300,
                        totalTimeMs: 1000,
                        rawSizeBytes: 2048,
                        markdownSizeChars: 1500,
                        totalChunks: 1,
                        avgChunkSize: 1500,
                        oversizedChunks: 0,
                        avgQualityScore: 0.85,
                        qualityFlags: { TOO_SHORT: 0 },
                        totalTokens: 150,
                    },
                },
            },
        });

        const prisma = getPrisma();
        const metrics = await prisma.processingMetrics.findUnique({
            where: { documentId: doc.id },
        });

        expect(metrics).not.toBeNull();
        expect(metrics?.pageCount).toBe(5);
        expect(metrics?.ocrApplied).toBe(true);
        expect(metrics?.conversionTimeMs).toBe(500);
        expect(metrics?.chunkingTimeMs).toBe(200);
        expect(metrics?.embeddingTimeMs).toBe(300);
        expect(metrics?.totalTimeMs).toBe(1000);
        expect(metrics?.rawSizeBytes).toBe(2048);
        expect(metrics?.markdownSizeChars).toBe(1500);
    });

    it('should calculate queueTimeMs from enqueuedAt and startedAt', async () => {
        const doc = await seedDocument({ status: 'PROCESSING' });
        // Simulate worker starting 2 seconds after document creation
        const startedAt = new Date(doc.createdAt.getTime() + 2000);

        await app.inject({
            method: 'POST',
            url: '/internal/callback',
            payload: {
                documentId: doc.id,
                success: true,
                result: {
                    processedContent: validContent,
                    chunks: [{ content: validContent, index: 0, embedding: Array(384).fill(0.1) }],
                    pageCount: 1,
                    ocrApplied: false,
                    processingTimeMs: 1000,
                    metrics: {
                        startedAt: startedAt.toISOString(),
                        totalTimeMs: 1000,
                    },
                },
            },
        });

        const prisma = getPrisma();
        const metrics = await prisma.processingMetrics.findUnique({
            where: { documentId: doc.id },
        });

        // Queue time should be approximately 2000ms (allow for test timing variance)
        expect(metrics?.queueTimeMs).toBeGreaterThanOrEqual(1900);
        expect(metrics?.queueTimeMs).toBeLessThanOrEqual(2500);
    });

    it('should calculate userWaitTimeMs as queueTimeMs + totalTimeMs', async () => {
        const doc = await seedDocument({ status: 'PROCESSING' });
        const startedAt = new Date(doc.createdAt.getTime() + 1000); // 1 second queue time

        await app.inject({
            method: 'POST',
            url: '/internal/callback',
            payload: {
                documentId: doc.id,
                success: true,
                result: {
                    processedContent: validContent,
                    chunks: [{ content: validContent, index: 0, embedding: Array(384).fill(0.1) }],
                    pageCount: 1,
                    ocrApplied: false,
                    processingTimeMs: 500,
                    metrics: {
                        startedAt: startedAt.toISOString(),
                        totalTimeMs: 500,
                    },
                },
            },
        });

        const prisma = getPrisma();
        const metrics = await prisma.processingMetrics.findUnique({
            where: { documentId: doc.id },
        });

        // userWaitTimeMs = queueTimeMs (~1000) + totalTimeMs (500) = ~1500
        expect(metrics?.userWaitTimeMs).toBeGreaterThanOrEqual(1400);
        expect(metrics?.userWaitTimeMs).toBeLessThanOrEqual(1700);
    });

    it('should store avgQualityScore from metrics', async () => {
        const doc = await seedDocument({ status: 'PROCESSING' });

        await app.inject({
            method: 'POST',
            url: '/internal/callback',
            payload: {
                documentId: doc.id,
                success: true,
                result: {
                    processedContent: validContent,
                    chunks: [{ content: validContent, index: 0, embedding: Array(384).fill(0.1) }],
                    pageCount: 1,
                    ocrApplied: false,
                    processingTimeMs: 100,
                    metrics: {
                        avgQualityScore: 0.87,
                        qualityFlags: { TOO_SHORT: 2, NO_CONTEXT: 1 },
                    },
                },
            },
        });

        const prisma = getPrisma();
        const metrics = await prisma.processingMetrics.findUnique({
            where: { documentId: doc.id },
        });

        expect(metrics?.avgQualityScore).toBe(0.87);
        expect(metrics?.qualityFlags).toEqual({ TOO_SHORT: 2, NO_CONTEXT: 1 });
    });

    it('should link ProcessingMetrics to Document via relation', async () => {
        const doc = await seedDocument({ status: 'PROCESSING' });

        await app.inject({
            method: 'POST',
            url: '/internal/callback',
            payload: {
                documentId: doc.id,
                success: true,
                result: {
                    processedContent: validContent,
                    chunks: [{ content: validContent, index: 0, embedding: Array(384).fill(0.1) }],
                    pageCount: 1,
                    ocrApplied: false,
                    processingTimeMs: 100,
                    metrics: {
                        totalTimeMs: 100,
                    },
                },
            },
        });

        const prisma = getPrisma();
        const docWithMetrics = await prisma.document.findUnique({
            where: { id: doc.id },
            include: { processingMetrics: true },
        });

        expect(docWithMetrics?.processingMetrics).not.toBeNull();
        expect(docWithMetrics?.processingMetrics?.documentId).toBe(doc.id);
    });

    it('should store chunking efficiency metrics', async () => {
        const doc = await seedDocument({ status: 'PROCESSING' });

        await app.inject({
            method: 'POST',
            url: '/internal/callback',
            payload: {
                documentId: doc.id,
                success: true,
                result: {
                    processedContent: validContent,
                    chunks: [
                        { content: 'Chunk 1', index: 0, embedding: Array(384).fill(0.1) },
                        { content: 'Chunk 2', index: 1, embedding: Array(384).fill(0.2) },
                        { content: 'Chunk 3', index: 2, embedding: Array(384).fill(0.3) },
                    ],
                    pageCount: 1,
                    ocrApplied: false,
                    processingTimeMs: 100,
                    metrics: {
                        totalChunks: 3,
                        avgChunkSize: 850.5,
                        oversizedChunks: 1,
                        totalTokens: 450,
                    },
                },
            },
        });

        const prisma = getPrisma();
        const metrics = await prisma.processingMetrics.findUnique({
            where: { documentId: doc.id },
        });

        expect(metrics?.totalChunks).toBe(3);
        expect(metrics?.avgChunkSize).toBe(850.5);
        expect(metrics?.oversizedChunks).toBe(1);
        expect(metrics?.totalTokens).toBe(450);
    });

    it('should handle callback without metrics gracefully', async () => {
        const doc = await seedDocument({ status: 'PROCESSING' });

        const response = await app.inject({
            method: 'POST',
            url: '/internal/callback',
            payload: {
                documentId: doc.id,
                success: true,
                result: {
                    processedContent: validContent,
                    chunks: [{ content: validContent, index: 0, embedding: Array(384).fill(0.1) }],
                    pageCount: 1,
                    ocrApplied: false,
                    processingTimeMs: 100,
                    // No metrics field - should still work
                },
            },
        });

        expect(response.statusCode).toBe(200);

        const prisma = getPrisma();
        const doc2 = await prisma.document.findUnique({
            where: { id: doc.id },
        });
        expect(doc2?.status).toBe('COMPLETED');

        // No ProcessingMetrics record should be created
        const metrics = await prisma.processingMetrics.findUnique({
            where: { documentId: doc.id },
        });
        expect(metrics).toBeNull();
    });

    it('should upsert metrics on retry callback', async () => {
        const doc = await seedDocument({ status: 'PROCESSING' });

        // First callback
        await app.inject({
            method: 'POST',
            url: '/internal/callback',
            payload: {
                documentId: doc.id,
                success: true,
                result: {
                    processedContent: validContent,
                    chunks: [{ content: validContent, index: 0, embedding: Array(384).fill(0.1) }],
                    pageCount: 1,
                    ocrApplied: false,
                    processingTimeMs: 100,
                    metrics: {
                        totalTimeMs: 100,
                        totalChunks: 1,
                    },
                },
            },
        });

        // Second callback (retry scenario) - should update, not fail
        await app.inject({
            method: 'POST',
            url: '/internal/callback',
            payload: {
                documentId: doc.id,
                success: true,
                result: {
                    processedContent: validContent,
                    chunks: [{ content: validContent, index: 0, embedding: Array(384).fill(0.1) }],
                    pageCount: 2,
                    ocrApplied: true,
                    processingTimeMs: 200,
                    metrics: {
                        totalTimeMs: 200,
                        totalChunks: 1,
                    },
                },
            },
        });

        const prisma = getPrisma();
        const metrics = await prisma.processingMetrics.findUnique({
            where: { documentId: doc.id },
        });

        // Should have updated values from second callback
        expect(metrics?.pageCount).toBe(2);
        expect(metrics?.ocrApplied).toBe(true);
        expect(metrics?.totalTimeMs).toBe(200);
    });
});
