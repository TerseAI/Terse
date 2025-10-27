import { SearchItem, SearchResult, SearchOptions } from "./SearchItem";

// Interface for embedding providers
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  dimensions(): number;
  modelName(): string;
}

// Error types
export class EmbeddingError extends Error {
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = "EmbeddingError";
  }
}

export interface Search {
  search(query: string, options: SearchOptions): Promise<SearchResult[]>;
  embed(text: string): Promise<number[]>;
  insert(item: SearchItem): Promise<void>;
  bulkInsert(items: SearchItem[]): Promise<void>;
  delete(entityId: string, entityType: string, teamId: string): Promise<void>;
  update(item: SearchItem): Promise<void>;
}

export class SearchError extends Error {
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = "SearchError";
  }
}
