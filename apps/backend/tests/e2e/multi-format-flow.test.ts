import { getTestApp, setupE2E, teardownE2E } from '@tests/e2e/setup/e2e-setup.js';
import { cleanDatabase, ensureDefaultProfile } from '@tests/helpers/database.js';
import { FIXTURES, readFixture } from '@tests/helpers/fixtures.js';
import { successCallback } from '@tests/mocks/python-worker-mock.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * E2E: Multi-Format Upload Flows
 * 
 * Tests non-PDF format processing: Markdown, TXT, JSON
 * Each test verifies: Upload → Callback → Query flow
 */

describe('E2E: Multi-Format Upload Flows', () => {
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

    it('Markdown: Upload → Callback → Query', async () => {
        const app = getTestApp();
        const mdBuffer = await readFixture(FIXTURES.markdown.withHeaders);

        // Upload
        const uploadResponse = await app.inject({
            method: 'POST',
            url: '/api/documents',
            headers: {
                'Content-Type': 'multipart/form-data; boundary=---e2e',
            },
            payload: createMultipartPayload('test.md', mdBuffer, 'text/markdown'),
        });

        expect(uploadResponse.statusCode).toBe(201);
        const { id: documentId } = uploadResponse.json();

        // Simulate worker callback
        const callbackResponse = await app.inject({
            method: 'POST',
            url: '/internal/callback',
            payload: successCallback(documentId, {
                markdown: `# Markdown Test Document

## Getting Started

This is a markdown document with multiple headers and
sufficient content for testing the document chunking system.

## Features

The document includes various markdown elements like headers,
paragraphs, and formatting to validate the processing pipeline.

## Conclusion

This concludes the markdown test content.`,
                pageCount: 1,
                ocrApplied: false,
                processingTimeMs: 50,
            }),
        });

        expect(callbackResponse.statusCode).toBe(200);

        // Verify completed
        const statusResponse = await app.inject({
            method: 'GET',
            url: `/api/documents/${documentId}`,
        });

        expect(statusResponse.json().status).toBe('COMPLETED');
        expect(statusResponse.json().chunkCount).toBeGreaterThan(0);

        // Query
        const queryResponse = await app.inject({
            method: 'POST',
            url: '/api/query',
            payload: { query: 'markdown features', topK: 5 },
        });

        expect(queryResponse.statusCode).toBe(200);
        expect(queryResponse.json().results.length).toBeGreaterThan(0);
    }, 60000);

    it('TXT: Upload → Callback → Query', async () => {
        const app = getTestApp();
        const txtBuffer = await readFixture(FIXTURES.text.normal);

        // Upload
        const uploadResponse = await app.inject({
            method: 'POST',
            url: '/api/documents',
            headers: {
                'Content-Type': 'multipart/form-data; boundary=---e2e',
            },
            payload: createMultipartPayload('test.txt', txtBuffer, 'text/plain'),
        });

        expect(uploadResponse.statusCode).toBe(201);
        const { id: documentId } = uploadResponse.json();

        // Simulate worker callback
        const callbackResponse = await app.inject({
            method: 'POST',
            url: '/internal/callback',
            payload: successCallback(documentId, {
                markdown: `Plain Text Document

This is a plain text file that has been processed for testing.
It contains enough content to pass the quality gate and be
chunked properly for vector search functionality.

The text discusses various topics and provides sufficient
semantic content for testing the query capabilities.`,
                pageCount: 1,
                ocrApplied: false,
                processingTimeMs: 30,
            }),
        });

        expect(callbackResponse.statusCode).toBe(200);

        // Verify completed
        const statusResponse = await app.inject({
            method: 'GET',
            url: `/api/documents/${documentId}`,
        });

        expect(statusResponse.json().status).toBe('COMPLETED');

        // Query
        const queryResponse = await app.inject({
            method: 'POST',
            url: '/api/query',
            payload: { query: 'plain text content', topK: 5 },
        });

        expect(queryResponse.statusCode).toBe(200);
        expect(queryResponse.json().results.length).toBeGreaterThan(0);
    }, 60000);

    it('JSON: Upload → Callback → Query', async () => {
        const app = getTestApp();
        const jsonBuffer = await readFixture(FIXTURES.json.valid);

        // Upload
        const uploadResponse = await app.inject({
            method: 'POST',
            url: '/api/documents',
            headers: {
                'Content-Type': 'multipart/form-data; boundary=---e2e',
            },
            payload: createMultipartPayload('test.json', jsonBuffer, 'application/json'),
        });

        expect(uploadResponse.statusCode).toBe(201);
        const { id: documentId } = uploadResponse.json();

        // Simulate worker callback with structured JSON content
        const callbackResponse = await app.inject({
            method: 'POST',
            url: '/internal/callback',
            payload: successCallback(documentId, {
                markdown: `JSON Document

This JSON file contains structured data that has been converted
to markdown format for processing. The content includes
configurations and settings organized in a hierarchical structure.

The data provides semantic meaning suitable for vector search
and demonstrates the JSON processing capabilities.`,
                pageCount: 1,
                ocrApplied: false,
                processingTimeMs: 25,
            }),
        });

        expect(callbackResponse.statusCode).toBe(200);

        // Verify completed
        const statusResponse = await app.inject({
            method: 'GET',
            url: `/api/documents/${documentId}`,
        });

        expect(statusResponse.json().status).toBe('COMPLETED');

        // Query
        const queryResponse = await app.inject({
            method: 'POST',
            url: '/api/query',
            payload: { query: 'JSON structured data', topK: 5 },
        });

        expect(queryResponse.statusCode).toBe(200);
        expect(queryResponse.json().results.length).toBeGreaterThan(0);
    }, 60000);
});

function createMultipartPayload(filename: string, buffer: Buffer, mimeType: string): Buffer {
    const boundary = '---e2e';
    const parts: Buffer[] = [];

    parts.push(Buffer.from(`--${boundary}\r\n`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`));
    parts.push(Buffer.from(`Content-Type: ${mimeType}\r\n\r\n`));
    parts.push(buffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    return Buffer.concat(parts);
}
