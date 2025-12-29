import { closeTestApp, createTestApp } from '@tests/helpers/api.js';
import { cleanDatabase, getPrisma, seedDocument } from '@tests/helpers/database.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const API_KEY = process.env.API_KEY || 'test-api-key';

describe('GET /api/documents/:id/content', () => {
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

    describe('validation', () => {
        it('should return 400 for invalid document ID', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/documents/invalid-id/content?format=markdown',
                headers: { 'X-API-Key': API_KEY },
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().error).toBe('INVALID_ID');
        });

        it('should return 400 for invalid format', async () => {
            const doc = await seedDocument({ status: 'COMPLETED' });

            const response = await app.inject({
                method: 'GET',
                url: `/api/documents/${doc.id}/content?format=invalid`,
                headers: { 'X-API-Key': API_KEY },
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().error).toBe('INVALID_FORMAT');
        });
    });

    describe('document state', () => {
        it('should return 404 for non-existent document', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/documents/00000000-0000-0000-0000-000000000000/content?format=markdown',
                headers: { 'X-API-Key': API_KEY },
            });

            expect(response.statusCode).toBe(404);
            expect(response.json().error).toBe('NOT_FOUND');
        });

        it('should return 409 for non-completed document', async () => {
            const doc = await seedDocument({ status: 'PROCESSING' });

            const response = await app.inject({
                method: 'GET',
                url: `/api/documents/${doc.id}/content?format=markdown`,
                headers: { 'X-API-Key': API_KEY },
            });

            expect(response.statusCode).toBe(409);
            expect(response.json().error).toBe('NOT_READY');
        });

        it('should return 409 for completed document without processedContent', async () => {
            const doc = await seedDocument({ status: 'COMPLETED' });

            const response = await app.inject({
                method: 'GET',
                url: `/api/documents/${doc.id}/content?format=markdown`,
                headers: { 'X-API-Key': API_KEY },
            });

            expect(response.statusCode).toBe(409);
            expect(response.json().error).toBe('NO_CONTENT');
        });
    });

    describe('markdown format', () => {
        it('should return markdown content with correct headers', async () => {
            const prisma = getPrisma();

            const doc = await seedDocument({ status: 'COMPLETED' });
            await prisma.document.update({
                where: { id: doc.id },
                data: { processedContent: '# Test Document\n\nThis is the content.' },
            });

            const response = await app.inject({
                method: 'GET',
                url: `/api/documents/${doc.id}/content?format=markdown`,
                headers: { 'X-API-Key': API_KEY },
            });

            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toContain('text/markdown');
            expect(response.body).toContain('# Test Document');
        });
    });

    describe('json format', () => {
        it('should return JSON with chunks', async () => {
            const prisma = getPrisma();

            const doc = await seedDocument({ status: 'COMPLETED' });
            await prisma.document.update({
                where: { id: doc.id },
                data: { processedContent: '# Test Document\n\nThis is the content.' },
            });

            // Create a chunk using raw SQL (chunks table has pgvector)
            const dummyEmbedding = `[${Array(384).fill(0.1).join(',')}]`;
            await prisma.$executeRaw`
              INSERT INTO chunks (id, document_id, content, chunk_index, embedding, created_at)
              VALUES (gen_random_uuid(), ${doc.id}, ${'Test chunk content'}, ${0}, ${dummyEmbedding}::vector, NOW())
            `;

            const response = await app.inject({
                method: 'GET',
                url: `/api/documents/${doc.id}/content?format=json`,
                headers: { 'X-API-Key': API_KEY },
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.id).toBe(doc.id);
            expect(body.processedContent).toContain('# Test Document');
            expect(body.chunks).toBeDefined();
            expect(body.chunks.length).toBe(1);
            expect(body.chunks[0].content).toBe('Test chunk content');
        });
    });
});
