import { ChunkerService } from '@/services/chunker-service.js';
import { beforeEach, describe, expect, it } from 'vitest';

describe('ChunkerService', () => {
  let chunker: ChunkerService;

  beforeEach(() => {
    chunker = new ChunkerService({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
  });

  describe('chunk()', () => {
    it('should return single chunk for short text', async () => {
      const text = 'Short text under chunk size limit.';
      const result = await chunker.chunk(text);

      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].content).toBe(text);
      expect(result.chunks[0].index).toBe(0);
    });

    it('should split long text into multiple chunks', async () => {
      const text = 'A'.repeat(2500); // Should split into ~3 chunks
      const result = await chunker.chunk(text);

      expect(result.chunks.length).toBeGreaterThan(1);
      // Each chunk should be <= chunkSize
      for (const chunk of result.chunks) {
        expect(chunk.content.length).toBeLessThanOrEqual(1000);
      }
    });

    it('should maintain overlap between chunks', async () => {
      const text = 'Word '.repeat(300); // ~1500 chars
      const result = await chunker.chunk(text);

      expect(result.chunks.length).toBeGreaterThanOrEqual(2);

      // Check overlap exists
      const chunk1End = result.chunks[0].content.slice(-100);
      const chunk2Start = result.chunks[1].content.slice(0, 100);

      // Some content should appear in both (overlap)
      const overlap = chunk1End.split(' ').filter(w =>
        chunk2Start.includes(w)
      );
      expect(overlap.length).toBeGreaterThan(0);
    });

    it('should track character positions', async () => {
      const text = 'First paragraph.\n\nSecond paragraph with more content to test positioning.';
      const result = await chunker.chunk(text);

      expect(result.chunks[0].metadata.charStart).toBe(0);
      expect(result.chunks[0].metadata.charEnd).toBeGreaterThan(0);
    });

    it('should preserve markdown headers', async () => {
      const markdown = `# Main Header

Content under main header.

## Section One

Content in section one that is long enough to potentially cause splitting.

## Section Two

More content in section two.`;

      const result = await chunker.chunk(markdown);

      // Headers should be preserved in chunks
      const allContent = result.chunks.map(c => c.content).join('');
      expect(allContent).toContain('# Main Header');
      expect(allContent).toContain('## Section One');
    });

    it('should preserve code blocks', async () => {
      const markdown = `# Code Example

Here is some code:

\`\`\`typescript
function hello() {
  console.log('world');
}
\`\`\`

More text after code.`;

      const result = await chunker.chunk(markdown);
      const allContent = result.chunks.map(c => c.content).join('');

      expect(allContent).toContain('```typescript');
      expect(allContent).toContain("console.log('world')");
    });

    it('should handle empty input', async () => {
      const result = await chunker.chunk('');
      expect(result.chunks).toHaveLength(0);
    });

    it('should handle whitespace-only input', async () => {
      const result = await chunker.chunk('   \n\n   ');
      expect(result.chunks).toHaveLength(0);
    });
  });

  describe('chunk metadata', () => {
    it('should include chunk index', async () => {
      const text = 'A'.repeat(2500);
      const result = await chunker.chunk(text);

      result.chunks.forEach((chunk, i) => {
        expect(chunk.index).toBe(i);
      });
    });

    it('should extract heading if present', async () => {
      const markdown = `## Section Title

Content under section.`;

      const result = await chunker.chunk(markdown);
      expect(result.chunks[0].metadata.heading).toBe('Section Title');
    });
  });

  describe('custom configuration', () => {
    it('should respect custom chunk size', async () => {
      const smallChunker = new ChunkerService({
        chunkSize: 100,
        chunkOverlap: 20,
      });

      const text = 'A'.repeat(500);
      const result = await smallChunker.chunk(text);

      expect(result.chunks.length).toBeGreaterThan(1);
      for (const chunk of result.chunks) {
        expect(chunk.content.length).toBeLessThanOrEqual(100);
      }
    });
  });
});
