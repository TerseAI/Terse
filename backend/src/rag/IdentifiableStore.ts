import { db } from "../prismaClient";
import { Identifiable, HydrationContext } from "./Hydrator";
import { requireHydrator } from "./HydratorRegistry";
import { requireHydratorType, HydratorType } from "../types/rag";

export class IdentifiableStore {
    constructor(private readonly ctx: HydrationContext) {}

    async store(ref: Identifiable): Promise<void> {
        await db().identifiable_refs.upsert({
            where: {
                entity_type_entity_id: {
                    entity_type: ref.entityType,
                    entity_id: ref.entityId
                }
            },
            create: {
                entity_type: ref.entityType,
                entity_id: ref.entityId
            },
            update: {} // No-op if exists
        });
    }

    async storeBulk(refs: Identifiable[]): Promise<void> {
        await db().identifiable_refs.createMany({
            data: refs.map(ref => ({
                entity_type: ref.entityType,
                entity_id: ref.entityId
            })),
            skipDuplicates: true
        });
    }

    async hydrate(ref: Identifiable): Promise<Identifiable> {
        const hydratorType = requireHydratorType(ref.entityType);
        const hydrator = requireHydrator(hydratorType, this.ctx);
        return hydrator.hydrate(ref);
    }

    async hydrateAll(refs: Identifiable[]): Promise<Identifiable[]> {
        if (refs.length === 0) return [];

        // Group refs by entityType (validated)
        const grouped = new Map<HydratorType, Identifiable[]>();
        for (const ref of refs) {
            const hydratorType = requireHydratorType(ref.entityType);
            const existing = grouped.get(hydratorType) ?? [];
            existing.push(ref);
            grouped.set(hydratorType, existing);
        }

        // Hydrate each group in parallel
        const results = await Promise.all(
            Array.from(grouped.entries()).map(async ([hydratorType, typeRefs]) => {
                const hydrator = requireHydrator(hydratorType, this.ctx);
                return hydrator.hydrateBulk(typeRefs);
            })
        );

        return results.flat();
    }

    async loadAndHydrate(entityType: HydratorType): Promise<Identifiable[]> {
        const refs = await db().identifiable_refs.findMany({
            where: { entity_type: entityType }
        });

        const identifiables: Identifiable[] = refs.map(r => ({
            entityType: entityType,
            entityId: r.entity_id
        }));

        return this.hydrateAll(identifiables);
    }

    async remove(ref: Identifiable): Promise<void> {
        await db().identifiable_refs.delete({
            where: {
                entity_type_entity_id: {
                    entity_type: ref.entityType,
                    entity_id: ref.entityId
                }
            }
        });
    }
}

