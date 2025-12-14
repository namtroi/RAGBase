import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanDatabase, getPrisma } from '../../helpers/database.js';
import { FIXTURES, readFixture } from '../../helpers/fixtures.js';
import { API_KEY, getTestApp, setupE2E, teardownE2E } from '../setup/e2e-setup.js';

describe('E2E: JSON Fast Lane Flow', () => {
  beforeAll(async () => {
    await setupE2E();
  }, 120000);

  afterAll(async () => {
    await teardownE2E();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('should process JSON directly without Python worker', async () => {
    const app = getTestApp();
    const jsonBuffer = await readFixture(FIXTURES.json.valid);

    // Step 1: Upload JSON
    const uploadResponse = await app.inject({
      method: 'POST',
      url: '/api/documents',
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'multipart/form-data; boundary=---e2e',
      },
      payload: createMultipartPayload('data.json', jsonBuffer, 'application/json'),
    });

    expect(uploadResponse.statusCode).toBe(201);

    const { id: documentId, lane } = uploadResponse.json();
    expect(lane).toBe('fast');

    // Step 2: Wait for fast lane processing (should be immediate)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 3: Check status is COMPLETED
    const statusResponse = await app.inject({
      method: 'GET',
      url: `/api/documents/${documentId}`,
      headers: { 'X-API-Key': API_KEY },
    });

    expect(statusResponse.json().status).toBe('COMPLETED');

    // Step 4: Query for JSON content
    const queryResponse = await app.inject({
      method: 'POST',
      url: '/api/query',
      headers: { 'X-API-Key': API_KEY },
      payload: { query: 'JSON content', topK: 3 },
    });

    expect(queryResponse.statusCode).toBe(200);
    expect(queryResponse.json().results.length).toBeGreaterThan(0);
  }, 30000);

  it('should process TXT file via fast lane', async () => {
    const app = getTestApp();
    const txtBuffer = await readFixture(FIXTURES.text.normal);

    const uploadResponse = await app.inject({
      method: 'POST',
      url: '/api/documents',
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'multipart/form-data; boundary=---e2e',
      },
      payload: createMultipartPayload('readme.txt', txtBuffer, 'text/plain'),
    });

    expect(uploadResponse.statusCode).toBe(201);
    expect(uploadResponse.json().lane).toBe('fast');

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    const { id } = uploadResponse.json();
    const statusResponse = await app.inject({
      method: 'GET',
      url: `/api/documents/${id}`,
      headers: { 'X-API-Key': API_KEY },
    });

    expect(statusResponse.json().status).toBe('COMPLETED');
  }, 30000);

  it('should process Markdown file via fast lane', async () => {
    const app = getTestApp();
    const mdBuffer = await readFixture(FIXTURES.markdown.withHeaders);

    const uploadResponse = await app.inject({
      method: 'POST',
      url: '/api/documents',
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'multipart/form-data; boundary=---e2e',
      },
      payload: createMultipartPayload('notes.md', mdBuffer, 'text/markdown'),
    });

    expect(uploadResponse.statusCode).toBe(201);
    expect(uploadResponse.json().lane).toBe('fast');

    await new Promise(resolve => setTimeout(resolve, 2000));

    const { id } = uploadResponse.json();
    const statusResponse = await app.inject({
      method: 'GET',
      url: `/api/documents/${id}`,
      headers: { 'X-API-Key': API_KEY },
    });

    expect(statusResponse.json().status).toBe('COMPLETED');

    // Verify chunks have heading metadata
    const prisma = getPrisma();
    const chunks = await prisma.chunk.findMany({
      where: { documentId: id },
    });

    const chunksWithHeading = chunks.filter((c: any) => c.heading);
    expect(chunksWithHeading.length).toBeGreaterThan(0);
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
