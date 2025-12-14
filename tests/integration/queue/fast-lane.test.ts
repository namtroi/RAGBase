import { FastLaneProcessor } from '@/services/fast-lane-processor';
import { cleanDatabase, getPrisma, seedDocument } from '@tests/helpers/database';
import { FIXTURES, readFixtureText } from '@tests/helpers/fixtures';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('FastLaneProcessor', () => {
  let processor: FastLaneProcessor;

  beforeAll(() => {
    processor = new FastLaneProcessor();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('JSON processing', () => {
    it('should process valid JSON file', async () => {
      const doc = await seedDocument({
        format: 'json',
        lane: 'fast',
        status: 'PENDING',
      });

      const content = await readFixtureText(FIXTURES.json.valid);
      const result = await processor.process(doc.id, content, 'json');

      expect(result.success).toBe(true);
      expect(result.chunksCreated).toBeGreaterThan(0);
    });

    it('should handle malformed JSON gracefully', async () => {
      const doc = await seedDocument({
        format: 'json',
        lane: 'fast',
        status: 'PENDING',
      });

      const content = await readFixtureText(FIXTURES.json.malformed);
      const result = await processor.process(doc.id, content, 'json');

      expect(result.success).toBe(false);
      expect(result.error).toContain('INVALID_JSON');
    });

    it('should update document status to COMPLETED', async () => {
      const doc = await seedDocument({
        format: 'json',
        lane: 'fast',
        status: 'PENDING',
      });

      const content = await readFixtureText(FIXTURES.json.valid);
      await processor.process(doc.id, content, 'json');

      const prisma = getPrisma();
      const updated = await prisma.document.findUnique({
        where: { id: doc.id },
      });

      expect(updated?.status).toBe('COMPLETED');
    });
  });

  describe('TXT processing', () => {
    it('should process plain text file', async () => {
      const doc = await seedDocument({
        format: 'txt',
        lane: 'fast',
        status: 'PENDING',
      });

      const content = await readFixtureText(FIXTURES.text.normal);
      const result = await processor.process(doc.id, content, 'txt');

      expect(result.success).toBe(true);
    });

    it('should handle unicode text', async () => {
      const doc = await seedDocument({
        format: 'txt',
        lane: 'fast',
        status: 'PENDING',
      });

      const content = await readFixtureText(FIXTURES.text.unicode);
      const result = await processor.process(doc.id, content, 'txt');

      expect(result.success).toBe(true);
    });

    it('should reject empty text file', async () => {
      const doc = await seedDocument({
        format: 'txt',
        lane: 'fast',
        status: 'PENDING',
      });

      const result = await processor.process(doc.id, '', 'txt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('TEXT_TOO_SHORT');
    });
  });

  describe('Markdown processing', () => {
    it('should process markdown with headers', async () => {
      const doc = await seedDocument({
        format: 'md',
        lane: 'fast',
        status: 'PENDING',
      });

      const content = await readFixtureText(FIXTURES.markdown.withHeaders);
      const result = await processor.process(doc.id, content, 'md');

      expect(result.success).toBe(true);
    });

    it('should preserve markdown structure in chunks', async () => {
      const doc = await seedDocument({
        format: 'md',
        lane: 'fast',
        status: 'PENDING',
      });

      const content = await readFixtureText(FIXTURES.markdown.withHeaders);
      await processor.process(doc.id, content, 'md');

      const prisma = getPrisma();
      const chunks = await prisma.chunk.findMany({
        where: { documentId: doc.id },
        orderBy: { chunkIndex: 'asc' },
      });

      // Should have heading metadata
      const chunksWithHeading = chunks.filter(c => c.heading);
      expect(chunksWithHeading.length).toBeGreaterThan(0);
    });
  });
});
