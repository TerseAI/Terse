import { db } from "../prismaClient";
import { Identifiable } from "./Hydrator";
import { getHydrator } from "./HydratorRegistry";

export class IdentifiableStore {
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
        const hydrator = getHydrator(ref.entityType);
        if (!hydrator) {
            throw new Error(`No hydrator registered for entityType: ${ref.entityType}`);
        }
        return hydrator.hydrate(ref);
    }

    async hydrateAll(refs: Identifiable[]): Promise<Identifiable[]> {
        if (refs.length === 0) return [];

        // Group refs by entityType
        const grouped = new Map<string, Identifiable[]>();
        for (const ref of refs) {
            const existing = grouped.get(ref.entityType) ?? [];
            existing.push(ref);
            grouped.set(ref.entityType, existing);
        }

        // Hydrate each group in parallel
        const results = await Promise.all(
            Array.from(grouped.entries()).map(async ([entityType, typeRefs]) => {
                const hydrator = getHydrator(entityType);
                if (!hydrator) {
                    throw new Error(`No hydrator registered for entityType: ${entityType}`);
                }
                return hydrator.hydrateBulk(typeRefs);
            })
        );

        return results.flat();
    }

    async loadAndHydrate(entityType: string): Promise<Identifiable[]> {
        const refs = await db().identifiable_refs.findMany({
            where: { entity_type: entityType }
        });

        const identifiables: Identifiable[] = refs.map((r: { entity_type: string; entity_id: string }) => ({
            entityType: r.entity_type,
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

