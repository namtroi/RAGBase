/**
 * QdrantService - Vector database integration for hybrid search
 *
 * Phase 5: Qdrant Cloud integration with dense + sparse vectors
 * Uses Qdrant's Query API for server-side RRF fusion
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { logger } from '../logging/logger.js';

// Types
export interface SparseVector {
  indices: number[];
  values: number[];
}

export interface HybridVector {
  dense: number[];
  sparse: SparseVector;
}

export interface QdrantPoint {
  id: string;
  vector: HybridVector;
  payload: {
    documentId: string;
    content: string;
    metadata: Record<string, unknown>;
  };
}

export interface HybridSearchParams {
  dense: number[];
  sparse: SparseVector;
  topK: number;
  filter?: {
    documentId?: string;
  };
}

export interface SearchResult {
  id: string;
  score: number;
  payload: {
    documentId: string;
    content: string;
    metadata: Record<string, unknown>;
  };
}

// Configuration
const QDRANT_URL = process.env.QDRANT_URL || '';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';
const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'ragbase_hybrid';
const DENSE_VECTOR_SIZE = 384;

export class QdrantService {
  private client: QdrantClient;
  private collectionName: string;
  private initialized = false;

  constructor(
    url: string = QDRANT_URL,
    apiKey: string = QDRANT_API_KEY,
    collectionName: string = COLLECTION_NAME
  ) {
    if (!url) {
      throw new Error('QDRANT_URL is required');
    }

    this.client = new QdrantClient({
      url,
      apiKey: apiKey || undefined,
    });
    this.collectionName = collectionName;
  }

  /**
   * Ensure collection exists with correct schema
   */
  async ensureCollection(): Promise<void> {
    if (this.initialized) return;

    try {
      const exists = await this.client.collectionExists(this.collectionName);

      if (!exists.exists) {
        logger.info({ collection: this.collectionName }, 'Creating Qdrant collection');

        await this.client.createCollection(this.collectionName, {
          vectors: {
            dense: {
              size: DENSE_VECTOR_SIZE,
              distance: 'Cosine',
            },
          },
          sparse_vectors: {
            sparse: {
              index: {
                on_disk: true, // Save RAM for free tier
              },
            },
          },
        });

        // Create payload index for documentId filtering
        await this.client.createPayloadIndex(this.collectionName, {
          field_name: 'documentId',
          field_schema: 'keyword',
        });

        logger.info({ collection: this.collectionName }, 'Qdrant collection created');
      } else {
        logger.debug({ collection: this.collectionName }, 'Qdrant collection exists');
      }

      this.initialized = true;
    } catch (error) {
      logger.error({ error, collection: this.collectionName }, 'Failed to ensure Qdrant collection');
      throw error;
    }
  }

  /**
   * Upsert points to collection
   */
  async upsertPoints(points: QdrantPoint[]): Promise<void> {
    if (points.length === 0) return;

    await this.ensureCollection();

    try {
      const qdrantPoints = points.map((p) => ({
        id: p.id,
        vector: {
          dense: p.vector.dense,
          sparse: {
            indices: p.vector.sparse.indices,
            values: p.vector.sparse.values,
          },
        },
        payload: {
          documentId: p.payload.documentId,
          content: p.payload.content,
          ...p.payload.metadata,
        },
      }));

      await this.client.upsert(this.collectionName, {
        wait: true,
        points: qdrantPoints,
      });

      logger.info({ count: points.length }, 'Upserted points to Qdrant');
    } catch (error) {
      logger.error({ error, count: points.length }, 'Failed to upsert points');
      throw error;
    }
  }

  /**
   * Delete points by IDs
   */
  async deletePoints(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    await this.ensureCollection();

    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        points: ids,
      });

      logger.info({ count: ids.length }, 'Deleted points from Qdrant');
    } catch (error) {
      logger.error({ error, count: ids.length }, 'Failed to delete points');
      throw error;
    }
  }

  /**
   * Delete all points for a document
   */
  async deleteByDocumentId(documentId: string): Promise<void> {
    await this.ensureCollection();

    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        filter: {
          must: [
            {
              key: 'documentId',
              match: { value: documentId },
            },
          ],
        },
      });

      logger.info({ documentId }, 'Deleted document points from Qdrant');
    } catch (error) {
      logger.error({ error, documentId }, 'Failed to delete document points');
      throw error;
    }
  }

  /**
   * Hybrid search using Qdrant Query API with RRF fusion
   */
  async hybridSearch(params: HybridSearchParams): Promise<SearchResult[]> {
    await this.ensureCollection();

    try {
      // Build filter if documentId specified
      const filter = params.filter?.documentId
        ? {
            must: [
              {
                key: 'documentId',
                match: { value: params.filter.documentId },
              },
            ],
          }
        : undefined;

      // Use Query API with prefetch for hybrid search
      // This performs RRF fusion server-side
      const response = await this.client.query(this.collectionName, {
        prefetch: [
          {
            query: {
              indices: params.sparse.indices,
              values: params.sparse.values,
            },
            using: 'sparse',
            limit: params.topK * 2, // Fetch more for fusion
          },
        ],
        query: params.dense,
        using: 'dense',
        limit: params.topK,
        with_payload: true,
        filter,
      });

      return response.points.map((p) => ({
        id: p.id as string,
        score: p.score ?? 0,
        payload: {
          documentId: (p.payload?.documentId as string) || '',
          content: (p.payload?.content as string) || '',
          metadata: p.payload as Record<string, unknown>,
        },
      }));
    } catch (error) {
      logger.error({ error, topK: params.topK }, 'Hybrid search failed');
      throw error;
    }
  }

  /**
   * Get collection info (for monitoring)
   */
  async getCollectionInfo(): Promise<{
    pointsCount: number;
    status: string;
  }> {
    await this.ensureCollection();

    try {
      const info = await this.client.getCollection(this.collectionName);
      return {
        pointsCount: info.points_count ?? 0,
        status: info.status,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get collection info');
      throw error;
    }
  }
}

// Singleton instance
let qdrantServiceInstance: QdrantService | null = null;

/**
 * Get singleton QdrantService instance
 */
export function getQdrantService(): QdrantService {
  if (!qdrantServiceInstance) {
    qdrantServiceInstance = new QdrantService();
  }
  return qdrantServiceInstance;
}

/**
 * Check if Qdrant is configured
 */
export function isQdrantConfigured(): boolean {
  return !!QDRANT_URL && process.env.VECTOR_DB_PROVIDER === 'qdrant';
}
