import { HydratorType } from "../types/rag";
import { SearchItem } from "./searchTypes";

/**
 * Interface for hydrating SearchItems into fully typed objects.
 * Each hydrator is responsible for a specific entityType.
 */
export interface Hydrator<T> {
    entityType: HydratorType;
    hydrate(entityReference: EntityReference): Promise<T>;
    hydrateBulk(entityReferences: EntityReference[]): Promise<T[]>;
}

export interface EntityReference {
    entityType: string;
    entityId: string;
}
