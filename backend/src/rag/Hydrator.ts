import { HydratorType } from "../types/rag";
import { SearchItem } from "./searchTypes";

/**
 * Interface for hydrating SearchItems into fully typed objects.
 * Each hydrator is responsible for a specific entityType.
 */
export interface Hydrator<T> {
    entityType: HydratorType;
    hydrate(searchItem: SearchItem<any>): Promise<T>;
    hydrateBulk(searchItems: SearchItem<any>[]): Promise<T[]>;
}
