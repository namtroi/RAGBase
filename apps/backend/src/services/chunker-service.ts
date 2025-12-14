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
