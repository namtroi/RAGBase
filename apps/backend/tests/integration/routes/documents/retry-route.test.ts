/**
 * Retry Route Integration Tests
 */

import { closeTestApp, createTestApp } from '@tests/helpers/api.js';
import { cleanDatabase, seedDocument } from '@tests/helpers/database.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('Retry Route', () => {
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

    describe('POST /api/documents/:id/retry', () => {
        it('should reset FAILED document to PENDING', async () => {
            const doc = await seedDocument({
                status: 'FAILED',
                failReason: 'Test failure',
                retryCount: 3,
            });

            const response = await app.inject({
                method: 'POST',
                url: `/api/documents/${doc.id}/retry`,
                headers: { 'X-API-Key': API_KEY },
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.id).toBe(doc.id);
            expect(body.status).toBe('PENDING');
        });

        it('should clear failReason and retryCount', async () => {
            const doc = await seedDocument({
                status: 'FAILED',
                failReason: 'Processing error',
                retryCount: 2,
            });

            await app.inject({
                method: 'POST',
                url: `/api/documents/${doc.id}/retry`,
                headers: { 'X-API-Key': API_KEY },
            });

            // Check document state
            const checkResponse = await app.inject({
                method: 'GET',
                url: `/api/documents/${doc.id}`,
                headers: { 'X-API-Key': API_KEY },
            });

            const docState = checkResponse.json();
            expect(docState.status).toBe('PENDING');
            expect(docState.failReason).toBeUndefined();
            expect(docState.retryCount).toBe(0);
        });

        it('should return 400 for non-FAILED document', async () => {
            const doc = await seedDocument({ status: 'COMPLETED' });

            const response = await app.inject({
                method: 'POST',
                url: `/api/documents/${doc.id}/retry`,
                headers: { 'X-API-Key': API_KEY },
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().error).toBe('INVALID_STATUS');
        });

        it('should return 400 for PROCESSING document', async () => {
            const doc = await seedDocument({ status: 'PROCESSING' });

            const response = await app.inject({
                method: 'POST',
                url: `/api/documents/${doc.id}/retry`,
                headers: { 'X-API-Key': API_KEY },
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().error).toBe('INVALID_STATUS');
        });

        it('should return 404 for non-existent document', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/documents/550e8400-e29b-41d4-a716-446655440000/retry',
                headers: { 'X-API-Key': API_KEY },
            });

            expect(response.statusCode).toBe(404);
            expect(response.json().error).toBe('NOT_FOUND');
        });

        it('should return 400 for invalid UUID', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/documents/not-a-uuid/retry',
                headers: { 'X-API-Key': API_KEY },
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().error).toBe('INVALID_ID');
        });
    });

    describe('POST /api/documents/bulk/retry', () => {
        it('should retry multiple FAILED documents', async () => {
            const doc1 = await seedDocument({ status: 'FAILED', md5Hash: 'h1', failReason: 'err1' });
            const doc2 = await seedDocument({ status: 'FAILED', md5Hash: 'h2', failReason: 'err2' });

            const response = await app.inject({
                method: 'POST',
                url: '/api/documents/bulk/retry',
                headers: { 'X-API-Key': API_KEY },
                payload: { documentIds: [doc1.id, doc2.id] },
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.retried).toBe(2);
            expect(body.failed).toHaveLength(0);
        });

        it('should skip non-FAILED documents and return partial success', async () => {
            const failed = await seedDocument({ status: 'FAILED', md5Hash: 'h1' });
            const completed = await seedDocument({ status: 'COMPLETED', md5Hash: 'h2' });

            const response = await app.inject({
                method: 'POST',
                url: '/api/documents/bulk/retry',
                headers: { 'X-API-Key': API_KEY },
                payload: { documentIds: [failed.id, completed.id] },
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.retried).toBe(1);
            expect(body.failed).toHaveLength(1);
            expect(body.failed[0].id).toBe(completed.id);
            expect(body.failed[0].reason).toContain('COMPLETED');
        });

        it('should handle non-existent documents in bulk', async () => {
            const doc = await seedDocument({ status: 'FAILED' });
            const nonExistentId = '550e8400-e29b-41d4-a716-446655440000';

            const response = await app.inject({
                method: 'POST',
                url: '/api/documents/bulk/retry',
                headers: { 'X-API-Key': API_KEY },
                payload: { documentIds: [doc.id, nonExistentId] },
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.retried).toBe(1);
            expect(body.failed).toHaveLength(1);
            expect(body.failed[0].id).toBe(nonExistentId);
            expect(body.failed[0].reason).toBe('Document not found');
        });

        it('should return 400 for empty documentIds array', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/documents/bulk/retry',
                headers: { 'X-API-Key': API_KEY },
                payload: { documentIds: [] },
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().error).toBe('VALIDATION_ERROR');
        });

        it('should return 400 for invalid UUIDs in array', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/documents/bulk/retry',
                headers: { 'X-API-Key': API_KEY },
                payload: { documentIds: ['not-a-uuid'] },
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().error).toBe('VALIDATION_ERROR');
        });
    });
});
