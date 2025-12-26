import { getPrismaClient } from './database.js';

/**
 * Parameters for hybrid search
 */
export interface HybridSearchParams {
    queryEmbedding: number[];
    queryText: string;
    topK: number;
    alpha: number; // 0.0 = pure keyword, 1.0 = pure vector
}

/**
 * Raw result from database queries before fusion
 */
interface RawSearchResult {
    id: string;
    content: string;
    document_id: string;
    char_start: number;
    char_end: number;
    page: number | null;
    heading: string | null;
    quality_score: number | null;
    chunk_type: string | null;
    breadcrumbs: string[];
}

/**
 * Search result with scoring breakdown
 */
export interface SearchResult {
    id: string;
    content: string;
    documentId: string;
    score: number;
    vectorScore: number;
    keywordScore: number;
    metadata: {
        charStart: number;
        charEnd: number;
        page?: number;
        heading?: string;
        qualityScore?: number;
        chunkType?: string;
        breadcrumbs?: string[];
    };
}

/**
 * RRF constant (standard value from research papers)
 */
const RRF_K = 60;

/**
 * Hybrid Search Service
 * Combines vector similarity and BM25 full-text search using Reciprocal Rank Fusion (RRF)
 */
export class HybridSearchService {
    /**
     * Calculate RRF score for a single result
     * score = alpha * (1 / (k + vector_rank)) + (1-alpha) * (1 / (k + keyword_rank))
     */
    static calculateRRFScore(
        vectorRank: number | null,
        keywordRank: number | null,
        alpha: number
    ): { score: number; vectorScore: number; keywordScore: number } {
        // If no rank, use a large number (poor ranking)
        const vRank = vectorRank ?? Infinity;
        const kRank = keywordRank ?? Infinity;

        const vectorScore = vRank === Infinity ? 0 : 1 / (RRF_K + vRank);
        const keywordScore = kRank === Infinity ? 0 : 1 / (RRF_K + kRank);

        const score = alpha * vectorScore + (1 - alpha) * keywordScore;

        return { score, vectorScore, keywordScore };
    }

    /**
     * Perform hybrid search combining vector and keyword search
     */
    async search(params: HybridSearchParams): Promise<SearchResult[]> {
        const { queryEmbedding, queryText, topK, alpha } = params;
        const prisma = getPrismaClient();

        // Fetch more results than topK for better fusion (2x or minimum 20)
        const fetchLimit = Math.max(topK * 2, 20);

        // Execute both searches in parallel
        const [vectorResults, keywordResults] = await Promise.all([
            this.vectorSearch(prisma, queryEmbedding, fetchLimit),
            this.keywordSearch(prisma, queryText, fetchLimit),
        ]);

        // Merge using RRF
        const mergedResults = this.mergeWithRRF(vectorResults, keywordResults, alpha);

        // Return top K
        return mergedResults.slice(0, topK);
    }

    /**
     * Vector similarity search using pgvector
     */
    private async vectorSearch(
        prisma: ReturnType<typeof getPrismaClient>,
        queryEmbedding: number[],
        limit: number
    ): Promise<RawSearchResult[]> {
        return prisma.$queryRaw<RawSearchResult[]>`
      SELECT
        c.id,
        c.content,
        c.document_id,
        c.char_start,
        c.char_end,
        c.page,
        c.heading,
        c.quality_score,
        c.chunk_type,
        c.breadcrumbs
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE d.status = 'COMPLETED' AND d.is_active = true
      ORDER BY c.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${limit}
    `;
    }

    /**
     * Keyword search using PostgreSQL full-text search (BM25-like via ts_rank)
     */
    private async keywordSearch(
        prisma: ReturnType<typeof getPrismaClient>,
        queryText: string,
        limit: number
    ): Promise<RawSearchResult[]> {
        // Convert query to tsquery format
        // Use plainto_tsquery for simple word matching
        return prisma.$queryRaw<RawSearchResult[]>`
      SELECT
        c.id,
        c.content,
        c.document_id,
        c.char_start,
        c.char_end,
        c.page,
        c.heading,
        c.quality_score,
        c.chunk_type,
        c.breadcrumbs
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE d.status = 'COMPLETED' 
        AND d.is_active = true
        AND c.search_vector IS NOT NULL
        AND c.search_vector @@ plainto_tsquery('english', ${queryText})
      ORDER BY ts_rank(c.search_vector, plainto_tsquery('english', ${queryText})) DESC
      LIMIT ${limit}
    `;
    }

    /**
     * Merge vector and keyword results using Reciprocal Rank Fusion
     */
    mergeWithRRF(
        vectorResults: RawSearchResult[],
        keywordResults: RawSearchResult[],
        alpha: number
    ): SearchResult[] {
        // Create rank maps (1-indexed)
        const vectorRankMap = new Map<string, number>();
        vectorResults.forEach((r, idx) => vectorRankMap.set(r.id, idx + 1));

        const keywordRankMap = new Map<string, number>();
        keywordResults.forEach((r, idx) => keywordRankMap.set(r.id, idx + 1));

        // Collect all unique results
        const resultMap = new Map<string, RawSearchResult>();
        vectorResults.forEach(r => resultMap.set(r.id, r));
        keywordResults.forEach(r => resultMap.set(r.id, r));

        // Calculate RRF scores
        const scoredResults: SearchResult[] = [];

        for (const [id, rawResult] of resultMap) {
            const vectorRank = vectorRankMap.get(id) ?? null;
            const keywordRank = keywordRankMap.get(id) ?? null;

            const { score, vectorScore, keywordScore } = HybridSearchService.calculateRRFScore(
                vectorRank,
                keywordRank,
                alpha
            );

            scoredResults.push({
                id,
                content: rawResult.content,
                documentId: rawResult.document_id,
                score,
                vectorScore,
                keywordScore,
                metadata: {
                    charStart: rawResult.char_start,
                    charEnd: rawResult.char_end,
                    page: rawResult.page ?? undefined,
                    heading: rawResult.heading ?? undefined,
                    qualityScore: rawResult.quality_score ?? undefined,
                    chunkType: rawResult.chunk_type ?? undefined,
                    breadcrumbs: rawResult.breadcrumbs?.length > 0 ? rawResult.breadcrumbs : undefined,
                },
            });
        }

        // Sort by score descending
        scoredResults.sort((a, b) => b.score - a.score);

        return scoredResults;
    }
}

// Singleton instance for convenience
export const hybridSearchService = new HybridSearchService();
