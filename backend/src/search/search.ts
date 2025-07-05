// Interface for embedding providers
export interface EmbeddingProvider {
    embed(text: string): Promise<number[]>;
    embedBatch(texts: string[]): Promise<number[][]>;
    dimensions(): number;
    modelName(): string;
}

// Error types
export class EmbeddingError extends Error {
    constructor(message: string, public cause?: Error) {
        super(message);
        this.name = 'EmbeddingError';
    }
}