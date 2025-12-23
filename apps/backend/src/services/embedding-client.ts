/**
 * Embedding Client Service
 * 
 * Calls AI Worker's /embed endpoint for query embedding.
 * Replaces the local fastembed-based EmbeddingService.
 */

const AI_WORKER_URL = process.env.AI_WORKER_URL || 'http://localhost:8000';

interface EmbedResponse {
    embeddings: number[][];
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
