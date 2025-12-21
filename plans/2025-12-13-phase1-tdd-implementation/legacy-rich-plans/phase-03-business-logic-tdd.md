# Phase 03: Business Logic (TDD)

**Parent:** [plan.md](./plan.md) | **Dependencies:** Phase 02 | **Blocks:** Phases 04-06

---

## Overview

| Field | Value |
|-------|-------|
| Date | 2025-12-13 |
| Priority | P0 (Critical) |
| Est. Hours | 8 |
| Status | Pending |

**Description:** TDD approach for core business logic: text chunking, quality gate, MD5 deduplication, and embedding generation. Write tests FIRST, then implement.

---

## Key Insights (from Research)

- LangChain MarkdownTextSplitter: chunkSize 500 chars (~128 tokens for all-MiniLM-L6-v2)
- Embedding model max 256 tokens; chunk to stay under limit
- Deterministic embeddings via seeded hash for test reproducibility
- @xenova/transformers: expensive init, use singleton pattern
- Quality gate: min 50 chars, noise ratio <80%

---

## Requirements

### Acceptance Criteria
- [ ] Text chunker splits at 1000 chars with 200 overlap
- [ ] Chunker preserves markdown structure (headers, code blocks)
- [ ] Quality gate rejects text < 50 chars
- [ ] Quality gate rejects noise ratio > 80%
- [ ] MD5 hash generated correctly for deduplication
- [ ] Embedding service returns 384d vectors
- [ ] All tests written before implementation (TDD)

---

## Architecture

### Business Logic Module Structure

```
src/
├── services/
│   ├── index.ts                    # Re-exports
│   ├── chunker-service.ts          # Text chunking
│   ├── quality-gate-service.ts     # Quality validation
│   ├── hash-service.ts             # MD5 deduplication
│   └── embedding-service.ts        # Vector generation
```

### Data Flow

```
Document Upload
      │
      ▼
┌─────────────┐
│ Hash Service│ → MD5 for dedup check
└─────────────┘
      │
      ▼
┌─────────────┐
│Quality Gate │ → Reject if low quality
└─────────────┘
      │
      ▼
┌─────────────┐
│  Chunker    │ → Split into chunks
└─────────────┘
      │
      ▼
┌─────────────┐
│ Embeddings  │ → Generate 384d vectors
└─────────────┘
```

---

## Related Code Files

| File | Purpose |
|------|---------|
| `tests/unit/services/chunker-service.test.ts` | Chunking tests |
| `tests/unit/services/quality-gate-service.test.ts` | Quality gate tests |
| `tests/unit/services/hash-service.test.ts` | MD5 hash tests |
| `tests/unit/services/embedding-service.test.ts` | Embedding tests |
| `src/services/chunker-service.ts` | Chunking implementation |
| `src/services/quality-gate-service.ts` | Quality gate impl |
| `src/services/hash-service.ts` | MD5 hash impl |
| `src/services/embedding-service.ts` | Embedding impl |

---

## Implementation Steps (TDD Cycle)

### Step 1: RED - Write Chunker Service Tests

```typescript
// tests/unit/services/chunker-service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ChunkerService, ChunkResult } from '@/services/chunker-service';

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
```

### Step 2: GREEN - Implement Chunker Service

```typescript
// src/services/chunker-service.ts
import { MarkdownTextSplitter } from 'langchain/text_splitter';

export interface ChunkMetadata {
  charStart: number;
  charEnd: number;
  heading?: string;
  page?: number;
}

export interface Chunk {
  content: string;
  index: number;
  metadata: ChunkMetadata;
}

export interface ChunkResult {
  chunks: Chunk[];
}

export interface ChunkerConfig {
  chunkSize: number;
  chunkOverlap: number;
}

const DEFAULT_CONFIG: ChunkerConfig = {
  chunkSize: 1000,
  chunkOverlap: 200,
};

export class ChunkerService {
  private splitter: MarkdownTextSplitter;
  private config: ChunkerConfig;

  constructor(config: Partial<ChunkerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.splitter = new MarkdownTextSplitter({
      chunkSize: this.config.chunkSize,
      chunkOverlap: this.config.chunkOverlap,
    });
  }

  async chunk(text: string): Promise<ChunkResult> {
    // Handle empty/whitespace input
    const trimmed = text.trim();
    if (!trimmed) {
      return { chunks: [] };
    }

    // Split text using LangChain
    const docs = await this.splitter.createDocuments([trimmed]);

    // Map to our format
    const chunks: Chunk[] = docs.map((doc, index) => {
      const content = doc.pageContent;
      const charStart = this.findCharStart(trimmed, content, index);

      return {
        content,
        index,
        metadata: {
          charStart,
          charEnd: charStart + content.length,
          heading: this.extractHeading(content),
        },
      };
    });

    return { chunks };
  }

  private findCharStart(fullText: string, chunk: string, index: number): number {
    // Simple approximation - find first occurrence after previous chunk
    if (index === 0) {
      return fullText.indexOf(chunk.slice(0, 50));
    }
    // For subsequent chunks, search from estimated position
    const estimatedStart = index * (this.config.chunkSize - this.config.chunkOverlap);
    const searchStart = Math.max(0, estimatedStart - this.config.chunkOverlap);
    const pos = fullText.indexOf(chunk.slice(0, 50), searchStart);
    return pos >= 0 ? pos : 0;
  }

  private extractHeading(content: string): string | undefined {
    // Find first markdown heading
    const match = content.match(/^#{1,6}\s+(.+)$/m);
    return match ? match[1].trim() : undefined;
  }
}
```

### Step 3: RED - Write Quality Gate Service Tests

```typescript
// tests/unit/services/quality-gate-service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { QualityGateService, QualityResult } from '@/services/quality-gate-service';

describe('QualityGateService', () => {
  let gate: QualityGateService;

  beforeEach(() => {
    gate = new QualityGateService({
      minTextLength: 50,
      maxNoiseRatio: 0.5,
      rejectNoiseRatio: 0.8,
    });
  });

  describe('validate()', () => {
    describe('text length validation', () => {
      it('should pass text meeting minimum length', () => {
        const text = 'A'.repeat(50);
        const result = gate.validate(text);

        expect(result.passed).toBe(true);
        expect(result.warnings).toHaveLength(0);
      });

      it('should reject text below minimum length', () => {
        const text = 'A'.repeat(49);
        const result = gate.validate(text);

        expect(result.passed).toBe(false);
        expect(result.reason).toBe('TEXT_TOO_SHORT');
      });

      it('should reject empty text', () => {
        const result = gate.validate('');

        expect(result.passed).toBe(false);
        expect(result.reason).toBe('TEXT_TOO_SHORT');
      });

      it('should count actual characters, not whitespace', () => {
        const text = '   A   '.repeat(10); // 70 chars but only ~10 actual
        const result = gate.validate(text);

        // Should fail because actual content < 50
        expect(result.passed).toBe(false);
      });
    });

    describe('noise ratio validation', () => {
      it('should pass low noise content', () => {
        const text = 'This is clean text with normal punctuation. It reads well.';
        const result = gate.validate(text);

        expect(result.passed).toBe(true);
        expect(result.noiseRatio).toBeLessThan(0.5);
      });

      it('should warn on moderate noise', () => {
        // ~55% special chars
        const text = 'Text!!@@##$$%%^^&&**(){}[]' + 'A'.repeat(50);
        const result = gate.validate(text);

        expect(result.passed).toBe(true);
        expect(result.warnings).toContain('HIGH_NOISE_RATIO');
      });

      it('should reject high noise content', () => {
        // >80% special chars
        const text = '!!@@##$$%%^^&&**(){}[]:::;;;|||\\\\///' + 'AB';
        const result = gate.validate(text);

        expect(result.passed).toBe(false);
        expect(result.reason).toBe('EXCESSIVE_NOISE');
      });

      it('should calculate noise ratio correctly', () => {
        // "Hello!" = 6 chars, 1 non-alphanumeric (!) = 1/6 = 0.167
        const text = 'Hello!';
        const result = gate.validate(text);

        expect(result.noiseRatio).toBeCloseTo(0.167, 1);
      });
    });

    describe('edge cases', () => {
      it('should handle unicode text', () => {
        const text = 'Xin chao! Duc Thanh van ban tieng Viet day du noi dung.';
        const result = gate.validate(text);

        expect(result.passed).toBe(true);
      });

      it('should handle markdown formatting', () => {
        const text = '# Header\n\n**Bold** and _italic_ with [links](url)';
        const result = gate.validate(text);

        // Markdown special chars shouldn't count as noise
        expect(result.passed).toBe(true);
      });

      it('should handle code blocks', () => {
        const code = '```js\nconst x = 1; // comment\nfunction test() {}\n```';
        const result = gate.validate(code);

        // Code blocks have legitimate special chars
        expect(result.passed).toBe(true);
      });
    });
  });

  describe('calculateNoiseRatio()', () => {
    it('should return 0 for pure alphanumeric', () => {
      const ratio = gate.calculateNoiseRatio('HelloWorld123');
      expect(ratio).toBe(0);
    });

    it('should return ratio of non-alphanumeric chars', () => {
      // "a!b@c" = 5 chars, 2 non-alphanum = 0.4
      const ratio = gate.calculateNoiseRatio('a!b@c');
      expect(ratio).toBe(0.4);
    });

    it('should handle empty string', () => {
      const ratio = gate.calculateNoiseRatio('');
      expect(ratio).toBe(0);
    });

    it('should ignore spaces in noise calculation', () => {
      // Spaces are not noise, only special chars
      const ratio = gate.calculateNoiseRatio('hello world');
      expect(ratio).toBeCloseTo(0.09, 1); // 1 space / 11 chars
    });
  });
});
```

### Step 4: GREEN - Implement Quality Gate Service

```typescript
// src/services/quality-gate-service.ts
export interface QualityConfig {
  minTextLength: number;
  maxNoiseRatio: number;    // Warn threshold
  rejectNoiseRatio: number; // Reject threshold
}

export interface QualityResult {
  passed: boolean;
  reason?: 'TEXT_TOO_SHORT' | 'EXCESSIVE_NOISE';
  warnings: string[];
  noiseRatio: number;
  textLength: number;
}

const DEFAULT_CONFIG: QualityConfig = {
  minTextLength: 50,
  maxNoiseRatio: 0.5,
  rejectNoiseRatio: 0.8,
};

export class QualityGateService {
  private config: QualityConfig;

  constructor(config: Partial<QualityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  validate(text: string): QualityResult {
    const warnings: string[] = [];

    // Calculate actual content length (non-whitespace)
    const contentLength = text.replace(/\s/g, '').length;

    // Check minimum length
    if (contentLength < this.config.minTextLength) {
      return {
        passed: false,
        reason: 'TEXT_TOO_SHORT',
        warnings: [],
        noiseRatio: 0,
        textLength: contentLength,
      };
    }

    // Calculate noise ratio
    const noiseRatio = this.calculateNoiseRatio(text);

    // Reject if too noisy
    if (noiseRatio > this.config.rejectNoiseRatio) {
      return {
        passed: false,
        reason: 'EXCESSIVE_NOISE',
        warnings: [],
        noiseRatio,
        textLength: contentLength,
      };
    }

    // Warn if moderately noisy
    if (noiseRatio > this.config.maxNoiseRatio) {
      warnings.push('HIGH_NOISE_RATIO');
    }

    return {
      passed: true,
      warnings,
      noiseRatio,
      textLength: contentLength,
    };
  }

  calculateNoiseRatio(text: string): number {
    if (text.length === 0) return 0;

    // Count non-alphanumeric, non-whitespace characters
    // But allow common markdown/code chars
    const allowedChars = /[a-zA-Z0-9\s]/;

    let noiseCount = 0;
    for (const char of text) {
      if (!allowedChars.test(char)) {
        noiseCount++;
      }
    }

    return noiseCount / text.length;
  }
}
```

### Step 5: RED - Write Hash Service Tests

```typescript
// tests/unit/services/hash-service.test.ts
import { describe, it, expect } from 'vitest';
import { HashService } from '@/services/hash-service';

describe('HashService', () => {
  describe('md5()', () => {
    it('should generate consistent MD5 hash for same input', () => {
      const buffer = Buffer.from('Hello, World!');
      const hash1 = HashService.md5(buffer);
      const hash2 = HashService.md5(buffer);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different input', () => {
      const buffer1 = Buffer.from('Hello');
      const buffer2 = Buffer.from('World');

      const hash1 = HashService.md5(buffer1);
      const hash2 = HashService.md5(buffer2);

      expect(hash1).not.toBe(hash2);
    });

    it('should return 32 character hex string', () => {
      const buffer = Buffer.from('test');
      const hash = HashService.md5(buffer);

      expect(hash).toHaveLength(32);
      expect(hash).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should generate known MD5 hash', () => {
      // Known MD5 hash of empty string
      const emptyHash = HashService.md5(Buffer.from(''));
      expect(emptyHash).toBe('d41d8cd98f00b204e9800998ecf8427e');

      // Known MD5 hash of "hello"
      const helloHash = HashService.md5(Buffer.from('hello'));
      expect(helloHash).toBe('5d41402abc4b2a76b9719d911017c592');
    });
  });

  describe('md5FromFile()', () => {
    it('should hash file buffer', async () => {
      const fileBuffer = Buffer.from('File content for testing');
      const hash = await HashService.md5FromFile(fileBuffer);

      expect(hash).toHaveLength(32);
      expect(hash).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should be deterministic for same file', async () => {
      const fileBuffer = Buffer.from('Consistent file content');

      const hash1 = await HashService.md5FromFile(fileBuffer);
      const hash2 = await HashService.md5FromFile(fileBuffer);

      expect(hash1).toBe(hash2);
    });
  });

  describe('isDuplicate()', () => {
    it('should detect duplicate hashes', () => {
      const existingHashes = new Set(['abc123', 'def456']);
      const isDupe = HashService.isDuplicate('abc123', existingHashes);

      expect(isDupe).toBe(true);
    });

    it('should return false for new hash', () => {
      const existingHashes = new Set(['abc123', 'def456']);
      const isDupe = HashService.isDuplicate('new789', existingHashes);

      expect(isDupe).toBe(false);
    });
  });
});
```

### Step 6: GREEN - Implement Hash Service

```typescript
// src/services/hash-service.ts
import { createHash } from 'crypto';

export class HashService {
  /**
   * Generate MD5 hash from buffer
   */
  static md5(buffer: Buffer): string {
    return createHash('md5').update(buffer).digest('hex');
  }

  /**
   * Generate MD5 hash from file buffer (async wrapper)
   */
  static async md5FromFile(buffer: Buffer): Promise<string> {
    return HashService.md5(buffer);
  }

  /**
   * Check if hash exists in set of existing hashes
   */
  static isDuplicate(hash: string, existingHashes: Set<string>): boolean {
    return existingHashes.has(hash);
  }
}
```

### Step 7: RED - Write Embedding Service Tests

```typescript
// tests/unit/services/embedding-service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmbeddingService } from '@/services/embedding-service';
import { mockTransformers, mockEmbedding } from '@tests/mocks/embedding-mock';

// Mock the transformers module
mockTransformers();

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(async () => {
    service = new EmbeddingService({
      model: 'Xenova/all-MiniLM-L6-v2',
      dimensions: 384,
      batchSize: 50,
    });
  });

  describe('embed()', () => {
    it('should return 384-dimension vector', async () => {
      const embedding = await service.embed('Hello world');

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding).toHaveLength(384);
    });

    it('should return numbers in valid range', async () => {
      const embedding = await service.embed('Test text');

      for (const value of embedding) {
        expect(typeof value).toBe('number');
        expect(Number.isFinite(value)).toBe(true);
      }
    });

    it('should return consistent embedding for same text', async () => {
      const text = 'Deterministic test';
      const embedding1 = await service.embed(text);
      const embedding2 = await service.embed(text);

      expect(embedding1).toEqual(embedding2);
    });

    it('should return different embeddings for different text', async () => {
      const embedding1 = await service.embed('First text');
      const embedding2 = await service.embed('Second text');

      expect(embedding1).not.toEqual(embedding2);
    });
  });

  describe('embedBatch()', () => {
    it('should embed multiple texts', async () => {
      const texts = ['Text one', 'Text two', 'Text three'];
      const embeddings = await service.embedBatch(texts);

      expect(embeddings).toHaveLength(3);
      for (const embedding of embeddings) {
        expect(embedding).toHaveLength(384);
      }
    });

    it('should return empty array for empty input', async () => {
      const embeddings = await service.embedBatch([]);
      expect(embeddings).toHaveLength(0);
    });

    it('should handle large batches', async () => {
      const texts = Array.from({ length: 100 }, (_, i) => `Text ${i}`);
      const embeddings = await service.embedBatch(texts);

      expect(embeddings).toHaveLength(100);
    });
  });

  describe('cosineSimilarity()', () => {
    it('should return 1 for identical vectors', () => {
      const vec = mockEmbedding('same text');
      const similarity = service.cosineSimilarity(vec, vec);

      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should return high similarity for similar texts', async () => {
      const vec1 = await service.embed('machine learning algorithms');
      const vec2 = await service.embed('machine learning methods');

      // With mock embeddings, similarity is based on hash
      // In real use, similar texts have high similarity
      const similarity = service.cosineSimilarity(vec1, vec2);
      expect(similarity).toBeDefined();
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should handle zero vectors', () => {
      const zero = new Array(384).fill(0);
      const vec = mockEmbedding('test');

      const similarity = service.cosineSimilarity(zero, vec);
      expect(similarity).toBe(0);
    });
  });

  describe('findSimilar()', () => {
    it('should return top K similar items', async () => {
      const queryEmbedding = mockEmbedding('query text');
      const candidates = [
        { id: '1', embedding: mockEmbedding('text one') },
        { id: '2', embedding: mockEmbedding('text two') },
        { id: '3', embedding: mockEmbedding('text three') },
      ];

      const results = service.findSimilar(queryEmbedding, candidates, 2);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBeDefined();
      expect(results[0].score).toBeDefined();
    });

    it('should sort by similarity descending', () => {
      const queryEmbedding = mockEmbedding('query');
      const candidates = [
        { id: '1', embedding: mockEmbedding('different') },
        { id: '2', embedding: mockEmbedding('query') }, // Same as query
        { id: '3', embedding: mockEmbedding('other') },
      ];

      const results = service.findSimilar(queryEmbedding, candidates, 3);

      // Same text should be most similar
      expect(results[0].id).toBe('2');
      expect(results[0].score).toBeCloseTo(1, 3);
    });
  });
});
```

### Step 8: GREEN - Implement Embedding Service

```typescript
// src/services/embedding-service.ts
import { pipeline } from '@xenova/transformers';

export interface EmbeddingConfig {
  model: string;
  dimensions: number;
  batchSize: number;
}

interface SimilarItem {
  id: string;
  embedding: number[];
}

interface SimilarResult {
  id: string;
  score: number;
}

const DEFAULT_CONFIG: EmbeddingConfig = {
  model: 'Xenova/all-MiniLM-L6-v2',
  dimensions: 384,
  batchSize: 50,
};

export class EmbeddingService {
  private config: EmbeddingConfig;
  private extractor: any = null;
  private initPromise: Promise<void> | null = null;

  constructor(config: Partial<EmbeddingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the embedding pipeline (singleton)
   */
  private async initialize(): Promise<void> {
    if (this.extractor) return;

    if (!this.initPromise) {
      this.initPromise = (async () => {
        this.extractor = await pipeline(
          'feature-extraction',
          this.config.model
        );
      })();
    }

    await this.initPromise;
  }

  /**
   * Generate embedding for single text
   */
  async embed(text: string): Promise<number[]> {
    await this.initialize();

    const output = await this.extractor(text, {
      pooling: 'mean',
      normalize: true,
    });

    return Array.from(output.data);
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    // Process in batches
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += this.config.batchSize) {
      const batch = texts.slice(i, i + this.config.batchSize);
      const embeddings = await Promise.all(batch.map(t => this.embed(t)));
      results.push(...embeddings);
    }

    return results;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vec1: number[], vec2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }

  /**
   * Find top K similar items
   */
  findSimilar(
    queryEmbedding: number[],
    candidates: SimilarItem[],
    topK: number
  ): SimilarResult[] {
    const scored = candidates.map(item => ({
      id: item.id,
      score: this.cosineSimilarity(queryEmbedding, item.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK);
  }
}
```

### Step 9: Create Index Re-export

```typescript
// src/services/index.ts
export { ChunkerService } from './chunker-service';
export type { Chunk, ChunkResult, ChunkerConfig, ChunkMetadata } from './chunker-service';

export { QualityGateService } from './quality-gate-service';
export type { QualityConfig, QualityResult } from './quality-gate-service';

export { HashService } from './hash-service';

export { EmbeddingService } from './embedding-service';
export type { EmbeddingConfig } from './embedding-service';
```

---

## Todo List

- [ ] Write `tests/unit/services/chunker-service.test.ts` (RED)
- [ ] Implement `src/services/chunker-service.ts` (GREEN)
- [ ] Refactor chunker if needed (REFACTOR)
- [ ] Write `tests/unit/services/quality-gate-service.test.ts` (RED)
- [ ] Implement `src/services/quality-gate-service.ts` (GREEN)
- [ ] Write `tests/unit/services/hash-service.test.ts` (RED)
- [ ] Implement `src/services/hash-service.ts` (GREEN)
- [ ] Write `tests/unit/services/embedding-service.test.ts` (RED)
- [ ] Implement `src/services/embedding-service.ts` (GREEN)
- [ ] Create `src/services/index.ts` re-exports
- [ ] Run `pnpm test:unit` - all tests pass
- [ ] Check coverage is 90%+ for services

---

## Success Criteria

1. All service tests pass (`pnpm test:unit`)
2. 90%+ coverage on `src/services/*`
3. Chunker handles markdown structure correctly
4. Quality gate catches low-quality content
5. Embedding service returns consistent 384d vectors

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| LangChain API changes | Pin version, use stable splitter |
| @xenova/transformers slow init | Singleton pattern, lazy loading |
| Memory issues with large batches | Configurable batch size |

---

## Security Considerations

- No user input in embedding queries
- Quality gate prevents garbage data storage
- MD5 for dedup only, not security

---

## Next Steps

After completion, proceed to [Phase 04: API Routes Integration (TDD)](./phase-04-api-routes-integration-tdd.md) to test and implement API endpoints.
