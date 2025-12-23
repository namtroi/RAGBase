/**
 * Embedding Client Service
 * 
 * Calls AI Worker's /embed endpoint for query embedding.
 * Replaces the local fastembed-based EmbeddingService.
 * 
 * In test mode (NODE_ENV=test), returns deterministic mock embeddings
 * to avoid requiring a running AI Worker.
 */

const AI_WORKER_URL = process.env.AI_WORKER_URL || 'http://localhost:8000';
const IS_TEST = process.env.NODE_ENV === 'test';

interface EmbedResponse {
    embeddings: number[][];
}

/**
 * Generate deterministic mock embedding from text hash
 * Same text always produces same vector for test reproducibility
 */
function mockEmbedding(text: string): number[] {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Array.from({ length: 384 }, (_, i) => Math.sin(hash + i) * 0.5);
}

export class EmbeddingClient {
    private baseUrl: string;

    constructor(baseUrl?: string) {
        this.baseUrl = baseUrl || AI_WORKER_URL;
    }

    /**
     * Generate embedding for a single text
     */
    async embed(text: string): Promise<number[]> {
        // In test mode, return mock embedding
        if (IS_TEST) {
            return mockEmbedding(text);
        }

        const response = await fetch(`${this.baseUrl}/embed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts: [text] }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Embedding request failed: ${error}`);
        }

        const data: EmbedResponse = await response.json();
        return data.embeddings[0];
    }

    /**
     * Generate embeddings for multiple texts
     */
    async embedBatch(texts: string[]): Promise<number[][]> {
        if (texts.length === 0) return [];

        // In test mode, return mock embeddings
        if (IS_TEST) {
            return texts.map(mockEmbedding);
        }

        const response = await fetch(`${this.baseUrl}/embed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Embedding batch request failed: ${error}`);
        }

        const data: EmbedResponse = await response.json();
        return data.embeddings;
    }
}
