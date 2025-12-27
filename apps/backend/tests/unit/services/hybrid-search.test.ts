import { describe, it, expect } from 'vitest';
import { HybridSearchService } from '@/services/hybrid-search.js';

describe('HybridSearchService', () => {
    describe('calculateRRFScore', () => {
        const RRF_K = 60; // Standard constant

        it('should calculate RRF score correctly for known ranks', () => {
            // Vector rank 1, keyword rank 2, alpha 0.5
            const result = HybridSearchService.calculateRRFScore(1, 2, 0.5);

            // Expected: 0.5 * (1/(60+1)) + 0.5 * (1/(60+2))
            const expectedVectorScore = 1 / (RRF_K + 1);
            const expectedKeywordScore = 1 / (RRF_K + 2);
            const expectedScore = 0.5 * expectedVectorScore + 0.5 * expectedKeywordScore;

            expect(result.vectorScore).toBeCloseTo(expectedVectorScore, 6);
            expect(result.keywordScore).toBeCloseTo(expectedKeywordScore, 6);
            expect(result.score).toBeCloseTo(expectedScore, 6);
        });

        it('should return pure vector score when alpha=1.0', () => {
            const result = HybridSearchService.calculateRRFScore(1, 5, 1.0);

            const expectedVectorScore = 1 / (RRF_K + 1);

            expect(result.score).toBeCloseTo(expectedVectorScore, 6);
            expect(result.vectorScore).toBeCloseTo(expectedVectorScore, 6);
            // Note: keywordScore is still calculated but not weighted
            expect(result.keywordScore).toBeCloseTo(1 / (RRF_K + 5), 6);
        });

        it('should return pure keyword score when alpha=0.0', () => {
            const result = HybridSearchService.calculateRRFScore(5, 1, 0.0);

            const expectedKeywordScore = 1 / (RRF_K + 1);

            expect(result.score).toBeCloseTo(expectedKeywordScore, 6);
            expect(result.keywordScore).toBeCloseTo(expectedKeywordScore, 6);
            // Note: vectorScore is still calculated but not weighted
            expect(result.vectorScore).toBeCloseTo(1 / (RRF_K + 5), 6);
        });

        it('should handle null vector rank (keyword only match)', () => {
            const result = HybridSearchService.calculateRRFScore(null, 1, 0.5);

            const expectedKeywordScore = 1 / (RRF_K + 1);

            expect(result.vectorScore).toBe(0);
            expect(result.keywordScore).toBeCloseTo(expectedKeywordScore, 6);
            expect(result.score).toBeCloseTo(0.5 * expectedKeywordScore, 6);
        });

        it('should handle null keyword rank (vector only match)', () => {
            const result = HybridSearchService.calculateRRFScore(1, null, 0.5);

            const expectedVectorScore = 1 / (RRF_K + 1);

            expect(result.vectorScore).toBeCloseTo(expectedVectorScore, 6);
            expect(result.keywordScore).toBe(0);
            expect(result.score).toBeCloseTo(0.5 * expectedVectorScore, 6);
        });

        it('should handle both ranks null (edge case)', () => {
            const result = HybridSearchService.calculateRRFScore(null, null, 0.5);

            expect(result.vectorScore).toBe(0);
            expect(result.keywordScore).toBe(0);
            expect(result.score).toBe(0);
        });

        it('should weight correctly with alpha=0.7 (70% vector)', () => {
            const result = HybridSearchService.calculateRRFScore(1, 1, 0.7);

            const rrfScore = 1 / (RRF_K + 1);
            const expectedScore = 0.7 * rrfScore + 0.3 * rrfScore; // Both same rank

            expect(result.score).toBeCloseTo(expectedScore, 6);
            expect(result.score).toBeCloseTo(rrfScore, 6); // Same as 1.0 * rrfScore
        });
    });

    describe('mergeWithRRF', () => {
        const service = new HybridSearchService();

        const createMockResult = (id: string, content: string = 'content') => ({
            id,
            content,
            document_id: 'doc-1',
            char_start: 0,
            char_end: 100,
            page: null,
            heading: null,
            quality_score: null,
            chunk_type: null,
            breadcrumbs: [],
        });

        it('should merge results and rank by RRF score', () => {
            const vectorResults = [
                createMockResult('chunk-1'),
                createMockResult('chunk-2'),
                createMockResult('chunk-3'),
            ];

            const keywordResults = [
                createMockResult('chunk-2'), // Best keyword match
                createMockResult('chunk-1'),
                createMockResult('chunk-4'), // Only in keyword results
            ];

            const merged = service.mergeWithRRF(vectorResults, keywordResults, 0.5);

            // Should have 4 unique results
            expect(merged).toHaveLength(4);

            // chunk-2 should rank highest (rank 2 in vector, rank 1 in keyword)
            // chunk-1 should rank second (rank 1 in vector, rank 2 in keyword)
            // With alpha=0.5, they should be close but chunk-1 edges out due to better vector rank
            expect(merged[0].id).toBe('chunk-1'); // Better vector rank matters
            expect(merged[1].id).toBe('chunk-2');
        });

        it('should handle empty vector results (pure keyword mode)', () => {
            const vectorResults: ReturnType<typeof createMockResult>[] = [];
            const keywordResults = [
                createMockResult('chunk-1'),
                createMockResult('chunk-2'),
            ];

            const merged = service.mergeWithRRF(vectorResults, keywordResults, 0.0);

            expect(merged).toHaveLength(2);
            expect(merged[0].id).toBe('chunk-1');
            expect(merged[0].vectorScore).toBe(0);
            expect(merged[0].keywordScore).toBeGreaterThan(0);
        });

        it('should handle empty keyword results (pure vector mode)', () => {
            const vectorResults = [
                createMockResult('chunk-1'),
                createMockResult('chunk-2'),
            ];
            const keywordResults: ReturnType<typeof createMockResult>[] = [];

            const merged = service.mergeWithRRF(vectorResults, keywordResults, 1.0);

            expect(merged).toHaveLength(2);
            expect(merged[0].id).toBe('chunk-1');
            expect(merged[0].vectorScore).toBeGreaterThan(0);
            expect(merged[0].keywordScore).toBe(0);
        });

        it('should handle both results empty', () => {
            const merged = service.mergeWithRRF([], [], 0.5);
            expect(merged).toHaveLength(0);
        });

        it('should include metadata in results', () => {
            const vectorResults = [
                {
                    ...createMockResult('chunk-1'),
                    page: 5,
                    heading: 'Section A',
                    quality_score: 0.85,
                    chunk_type: 'paragraph',
                    breadcrumbs: ['Chapter 1', 'Section A'],
                },
            ];
            const keywordResults: typeof vectorResults = [];

            const merged = service.mergeWithRRF(vectorResults, keywordResults, 1.0);

            expect(merged[0].metadata.page).toBe(5);
            expect(merged[0].metadata.heading).toBe('Section A');
            expect(merged[0].metadata.qualityScore).toBe(0.85);
            expect(merged[0].metadata.chunkType).toBe('paragraph');
            expect(merged[0].metadata.breadcrumbs).toEqual(['Chapter 1', 'Section A']);
        });

        it('should sort results by score descending', () => {
            // Create scenario where chunk-3 has best combined score
            const vectorResults = [
                createMockResult('chunk-1'), // Vector rank 1
                createMockResult('chunk-3'), // Vector rank 2
            ];
            const keywordResults = [
                createMockResult('chunk-3'), // Keyword rank 1 - chunk-3 is in both!
                createMockResult('chunk-2'), // Keyword rank 2
            ];

            const merged = service.mergeWithRRF(vectorResults, keywordResults, 0.5);

            // chunk-3: vector rank 2, keyword rank 1 -> 0.5 * (1/62) + 0.5 * (1/61)
            // chunk-1: vector rank 1, keyword null -> 0.5 * (1/61) + 0
            // chunk-2: vector null, keyword rank 2 -> 0 + 0.5 * (1/62)

            // All results should be in descending score order
            for (let i = 0; i < merged.length - 1; i++) {
                expect(merged[i].score).toBeGreaterThanOrEqual(merged[i + 1].score);
            }

            // chunk-3 should be first (appears in both)
            expect(merged[0].id).toBe('chunk-3');
        });
    });
});
