/**
 * Qdrant Hybrid Search Service
 *
 * Phase 5E: Qdrant Cloud hybrid search with RRF fusion
 * Replaces pgvector + tsvector when VECTOR_DB_PROVIDER=qdrant
 */

import { getQdrantService, isQdrantConfigured } from './qdrant.service.js';
import { logger } from '../logging/logger.js';

const AI_WORKER_URL = process.env.AI_WORKER_URL || 'http://localhost:8000';

/**
 * Query embedding response from AI Worker /embed/query
 */
interface QueryEmbedding {
    dense: number[];
    sparse: {
        indices: number[];
        values: number[];
    };
}

/**
 * Search result from Qdrant
 */
export interface QdrantSearchResult {
    id: string;
    content: string;
    documentId: string;
    score: number;
    metadata: {
        qualityScore?: number;
        qualityFlags?: string[];
        chunkType?: string;
        chunkIndex?: number;
        breadcrumbs?: string[];
        tokenCount?: number;
    };
}

/**
 * Search parameters for Qdrant hybrid search
 */
export interface QdrantHybridSearchParams {
    queryText: string;
    topK: number;
    documentId?: string;  // Optional filter by document
    mode?: 'semantic' | 'hybrid';  // semantic = dense-only, hybrid = dense+sparse (default)
}

/**
 * Qdrant-based Hybrid Search Service
 * Uses AI Worker for query embedding + Qdrant for vector search
 */
export class QdrantHybridSearchService {
    /**
     * Get hybrid embedding for query text from AI Worker
     */
    private async embedQuery(queryText: string): Promise<QueryEmbedding> {
        const response = await fetch(`${AI_WORKER_URL}/embed/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: queryText }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AI Worker embed failed: ${response.status} - ${errorText}`);
        }

        return response.json();
    }

    /**
     * Perform hybrid search using Qdrant
     */
    async search(params: QdrantHybridSearchParams): Promise<QdrantSearchResult[]> {
        const { queryText, topK, documentId, mode = 'hybrid' } = params;

        logger.info({ queryText: queryText.slice(0, 50), topK, mode }, 'qdrant_search_start');

        // 1. Get query embeddings from AI Worker
        const queryVectors = await this.embedQuery(queryText);

        // 2. Qdrant search based on mode
        const qdrant = getQdrantService();
        let results;

        if (mode === 'semantic') {
            // Semantic mode: use only dense vector (cosine similarity)
            results = await qdrant.denseSearch({
                dense: queryVectors.dense,
                topK,
                filter: documentId ? { documentId } : undefined,
            });
        } else {
            // Hybrid mode: use dense + sparse with RRF fusion
            results = await qdrant.hybridSearch({
                dense: queryVectors.dense,
                sparse: queryVectors.sparse,
                topK,
                filter: documentId ? { documentId } : undefined,
            });
        }

        // 3. Map results
        const searchResults: QdrantSearchResult[] = results.map((r) => ({
            id: r.id,
            content: r.payload.content,
            documentId: r.payload.documentId,
            score: r.score,
            metadata: {
                qualityScore: r.payload.metadata?.qualityScore as number | undefined,
                qualityFlags: r.payload.metadata?.qualityFlags as string[] | undefined,
                chunkType: r.payload.metadata?.chunkType as string | undefined,
                chunkIndex: r.payload.metadata?.chunkIndex as number | undefined,
                breadcrumbs: r.payload.metadata?.breadcrumbs as string[] | undefined,
                tokenCount: r.payload.metadata?.tokenCount as number | undefined,
            },
        }));

        logger.info({ count: searchResults.length }, 'qdrant_search_complete');

        return searchResults;
    }
}

// Singleton instance
export const qdrantHybridSearchService = new QdrantHybridSearchService();

/**
 * Check if Qdrant search should be used
 */
export function shouldUseQdrantSearch(): boolean {
    return isQdrantConfigured();
}
