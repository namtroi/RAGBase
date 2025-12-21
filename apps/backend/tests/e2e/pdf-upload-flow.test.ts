import { API_KEY, getTestApp, setupE2E, teardownE2E } from '@tests/e2e/setup/e2e-setup.js';
import { cleanDatabase } from '@tests/helpers/database.js';
import { FIXTURES, readFixture } from '@tests/helpers/fixtures.js';
import { successCallback } from '@tests/mocks/python-worker-mock.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('E2E: PDF Upload Flow', () => {
  beforeAll(async () => {
    await setupE2E();
  }, 120000);

  afterAll(async () => {
    await teardownE2E();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('should process PDF: Upload → Queue → Callback → Chunks → Query', async () => {
    const app = getTestApp();
    const pdfBuffer = await readFixture(FIXTURES.pdf.digital);

    // Step 1: Upload PDF
    const uploadResponse = await app.inject({
      method: 'POST',
      url: '/api/documents',
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'multipart/form-data; boundary=---e2e',
      },
      payload: createMultipartPayload('test.pdf', pdfBuffer, 'application/pdf'),
    });

    expect(uploadResponse.statusCode).toBe(201);
    const { id: documentId } = uploadResponse.json();
    expect(documentId).toBeDefined();

    // Step 2: Verify document is PENDING
    let statusResponse = await app.inject({
      method: 'GET',
      url: `/api/documents/${documentId}`,
      headers: { 'X-API-Key': API_KEY },
    });

    expect(statusResponse.json().status).toBe('PENDING');

    // Step 3: Simulate Python worker callback
    const callbackResponse = await app.inject({
      method: 'POST',
      url: '/internal/callback',
      payload: successCallback(documentId, {
        markdown: `# Test Document

## Introduction

This is a test document that has been processed by Docling.
It contains enough content to pass the quality gate validation.

## Main Content

The main content section discusses important topics that will be
chunked and embedded for vector search. Each chunk should maintain
semantic coherence while staying within the configured size limits.

## Conclusion

This concludes the test document content.`,
        pageCount: 1,
        ocrApplied: false,
        processingTimeMs: 250,
      }),
    });

    expect(callbackResponse.statusCode).toBe(200);

    // Step 4: Verify document is COMPLETED
    statusResponse = await app.inject({
      method: 'GET',
      url: `/api/documents/${documentId}`,
      headers: { 'X-API-Key': API_KEY },
    });

    const statusBody = statusResponse.json();
    expect(statusBody.status).toBe('COMPLETED');
    expect(statusBody.chunkCount).toBeGreaterThan(0);

    // Step 5: Query for content
    const queryResponse = await app.inject({
      method: 'POST',
      url: '/api/query',
      headers: { 'X-API-Key': API_KEY },
      payload: {
        query: 'test document content',
        topK: 5,
      },
    });

    expect(queryResponse.statusCode).toBe(200);

    const results = queryResponse.json().results;
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].documentId).toBe(documentId);
    expect(results[0].score).toBeGreaterThan(0);
  }, 60000);

  it('should route PDF to heavy lane', async () => {
    const app = getTestApp();
    const pdfBuffer = await readFixture(FIXTURES.pdf.digital);

    const uploadResponse = await app.inject({
      method: 'POST',
      url: '/api/documents',
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'multipart/form-data; boundary=---e2e',
      },
      payload: createMultipartPayload('test.pdf', pdfBuffer, 'application/pdf'),
    });

    expect(uploadResponse.statusCode).toBe(201);
    expect(uploadResponse.json().lane).toBe('heavy');
  }, 30000);
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
