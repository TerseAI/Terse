

export interface Indexer<T> {
    remember(event: T): Promise<void>;
    rememberBulk(events: T[]): Promise<void>;
}
