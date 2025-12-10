import { Filter } from "@turbopuffer/turbopuffer/resources/custom.mjs";


export interface Search<T, M> {
    search(query: string, options?: SearchOptions): Promise<T[]>;
    embed(text: string): Promise<number[]>;
    insert(item: SearchItem<M>): Promise<void>;
    bulkInsert(items: SearchItem<M>[]): Promise<void>;
    delete(entityId: string, entityType: string, teamId: string): Promise<void>;
    update(item: SearchItem<M>): Promise<void>;
}

export interface SearchOptions {
    topK?: number;
    rankingColumn?: string;
    rankingFunction?: RankingFunction,
    filters?: Filter | undefined,
    includeAttributes?: string[];
}

export enum RankingFunction {
    ANN = "ANN"
}

export type DistanceMetric = "cosine_distance" | "euclidean_distance" | "dot_product";



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


export class SearchError extends Error {
    constructor(message: string, public cause?: Error) {
        super(message);
        this.name = 'SearchError';
    }
}
export interface SearchItem<M> {
    id: string;
    entityType: string; 
    entityId: string; 
    content: string;
    metadata: M; 
}

