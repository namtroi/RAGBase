import { ChunkerService } from './chunker-service.js';
import { getPrisma } from './database.js';
import { EmbeddingService } from './embedding-service.js';
import { QualityGateService } from './quality-gate-service.js';

interface ProcessingResult {
  success: boolean;
  chunksCreated?: number;
  error?: string;
}

export class FastLaneProcessor {
  private chunker: ChunkerService;
  private qualityGate: QualityGateService;
  private embedder: EmbeddingService;

  constructor() {
    this.chunker = new ChunkerService({ chunkSize: 1000, chunkOverlap: 200 });
    this.qualityGate = new QualityGateService();
    this.embedder = new EmbeddingService();
  }

  async process(
    documentId: string,
    content: string,
    format: 'json' | 'txt' | 'md'
  ): Promise<ProcessingResult> {
    const prisma = getPrisma();

    try {
      // Update status to PROCESSING
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'PROCESSING' },
      });

      // Convert to text if JSON
      let text = content;
      if (format === 'json') {
        try {
          const parsed = JSON.parse(content);
          text = JSON.stringify(parsed, null, 2);
        } catch {
          await this.markFailed(documentId, 'INVALID_JSON');
          return { success: false, error: 'INVALID_JSON' };
        }
      }

      // Quality gate
      const quality = this.qualityGate.validate(text);
      if (!quality.passed) {
        await this.markFailed(documentId, quality.reason!);
        return { success: false, error: quality.reason };
      }

      // Chunk
      const { chunks } = await this.chunker.chunk(text);

      if (chunks.length === 0) {
        await this.markFailed(documentId, 'NO_CONTENT');
        return { success: false, error: 'NO_CONTENT' };
      }

      // Generate embeddings
      const embeddings = await this.embedder.embedBatch(
        chunks.map(c => c.content)
      );

      // Save chunks
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];

        await prisma.$executeRaw`
          INSERT INTO chunks (id, document_id, content, chunk_index, embedding, char_start, char_end, heading, created_at)
          VALUES (
            gen_random_uuid(),
            ${documentId},
            ${chunk.content},
            ${chunk.index},
            ${embedding}::vector,
            ${chunk.metadata.charStart},
            ${chunk.metadata.charEnd},
            ${chunk.metadata.heading || null},
            NOW()
          )
        `;
      }

      // Mark completed
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'COMPLETED' },
      });

      return { success: true, chunksCreated: chunks.length };
    } catch (err: any) {
      await this.markFailed(documentId, `PROCESSING_ERROR: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  private async markFailed(documentId: string, reason: string): Promise<void> {
    const prisma = getPrisma();
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'FAILED',
        failReason: reason,
      },
    });
  }
}
