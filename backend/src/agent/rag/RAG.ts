export interface RAG {
    embeddingModel: EmbeddingModel;

    search(namespace: string, query: string, options: SearchOptions): Promise<SearchResult[]>;
    embed(namespace: string, text: string, id: string): Promise<void>;
    embedBatch(namespace: string, texts: string[], ids: string[]): Promise<void>;
}

export interface EmbeddingModel {
    embed(text: string): Promise<number[]>;
    embedBatch(texts: string[]): Promise<number[][]>;
}

export interface SearchResult {
    id: string;
    embedding: number[];
}

export interface SearchOptions {
    limit: number;
}


