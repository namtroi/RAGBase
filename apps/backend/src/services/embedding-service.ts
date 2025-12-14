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
