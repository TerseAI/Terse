import { HydratorType } from "../types/rag";

// Base interface for any object that can be identified by entityType + entityId.
export interface Identifiable {
    entityType: HydratorType;
    entityId: string;
}

// Utility type to make any type Identifiable.
export type WithIdentity<T> = T & Identifiable;

// Context passed to hydrators for API access, user-specific data, etc.
export interface HydrationContext {
    userId: string;
}

// Abstract base class that enforces constructor signature
export abstract class Hydrator<T extends Identifiable> {
    abstract readonly entityType: HydratorType;
    
    constructor(protected readonly ctx: HydrationContext) {}
    
    abstract hydrate(ref: Identifiable): Promise<T>;
    abstract hydrateBulk(refs: Identifiable[]): Promise<T[]>;
}

// Extract the output type from a Hydrator
type HydratorOutput<H> = H extends Hydrator<infer T> ? T : never;

// Union of output types from an array of Hydrators
type CompositeOutput<H extends Hydrator<Identifiable>[]> = HydratorOutput<H[number]>;

// Composes multiple single-type hydrators into one that returns their union.
// Delegates to the appropriate hydrator based on entityType.
export class CompositeHydrator<H extends Hydrator<Identifiable>[]> {
    private hydrators: Map<HydratorType, Hydrator<Identifiable>>;
    
    constructor(...hydrators: H) {
        this.hydrators = new Map(hydrators.map(h => [h.entityType, h]));
    }

    async hydrate(ref: Identifiable): Promise<CompositeOutput<H>> {
        const hydrator = this.hydrators.get(ref.entityType);
        if (!hydrator) {
            throw new Error(`No hydrator for entityType: ${ref.entityType}`);
        }
        return hydrator.hydrate(ref) as Promise<CompositeOutput<H>>;
    }

    async hydrateBulk(refs: Identifiable[]): Promise<CompositeOutput<H>[]> {
        if (refs.length === 0) return [];

        // Group by entityType
        const grouped = new Map<HydratorType, Identifiable[]>();
        for (const ref of refs) {
            const existing = grouped.get(ref.entityType) ?? [];
            existing.push(ref);
            grouped.set(ref.entityType, existing);
        }

        // Hydrate each group in parallel
        const results = await Promise.all(
            Array.from(grouped.entries()).map(async ([type, typeRefs]) => {
                const hydrator = this.hydrators.get(type);
                if (!hydrator) {
                    throw new Error(`No hydrator for entityType: ${type}`);
                }
                return hydrator.hydrateBulk(typeRefs);
            })
        );

        return results.flat() as CompositeOutput<H>[];
    }

    supports(entityType: HydratorType): boolean {
        return this.hydrators.has(entityType);
    }
}
