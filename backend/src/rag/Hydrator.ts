import { HydratorType } from "../types/rag";

/**
 * Base interface for any object that can be identified by entityType + entityId.
 * Similar to Swift's Identifiable protocol.
 */
export interface Identifiable {
    entityType: string;
    entityId: string;
}

/**
 * Utility type to make any type Identifiable.
 * Use this to enrich types that don't natively have entityType/entityId.
 */
export type WithIdentity<T> = T & Identifiable;

/**
 * Interface for hydrating Identifiable references into fully typed objects.
 * Each hydrator is responsible for a specific entityType.
 */
export interface Hydrator<T extends Identifiable> {
    entityType: HydratorType;
    hydrate(ref: Identifiable): Promise<T>;
    hydrateBulk(refs: Identifiable[]): Promise<T[]>;
}
