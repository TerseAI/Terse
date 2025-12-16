import { db } from "../prismaClient";
import { Identifiable, HydrationContext } from "./Hydrator";
import { getHydrator } from "./HydratorRegistry";
import { parseHydratorType, HydratorType, HydratorTypeMap } from "../types/rag";

type HydratedEvent = HydratorTypeMap[HydratorType];

type AttributionWithRef = {
    source_item_ref: { entity_type: string; entity_id: string } | null;
    created_at: Date;
};

export class AttributionStore {
    constructor(private readonly ctx: HydrationContext) {}

    async fetchAttributionsForOutputItem(outputItemId: string): Promise<HydratedEvent[]> {
        const attributions = await db().output_change_attributions.findMany({
            where: {
                output_item_id: outputItemId,
            },
            include: {
                source_item_ref: true,
            },
            orderBy: {
                created_at: 'asc'
            },
        });

        return this.processAttributions(attributions);
    }
    
    async fetchAttributionsForOutputItems(outputItemIds: string[]): Promise<Map<string, HydratedEvent[]>> {
        if (outputItemIds.length === 0) {
            return new Map();
        }

        const attributions = await db().output_change_attributions.findMany({
            where: {
                output_item_id: { in: outputItemIds },
            },
            include: {
                source_item_ref: true,
            },
            orderBy: {
                created_at: 'asc'
            },
        });

        // Group attributions by output_item_id
        const attributionsByOutputItem = new Map<string, typeof attributions>();
        for (const attr of attributions) {
            const existing = attributionsByOutputItem.get(attr.output_item_id) ?? [];
            existing.push(attr);
            attributionsByOutputItem.set(attr.output_item_id, existing);
        }

        // Process attributions for each output item
        const result = new Map<string, HydratedEvent[]>();
        for (const [outputItemId, attrs] of attributionsByOutputItem.entries()) {
            const hydratedEvents = await this.processAttributions(attrs);
            result.set(outputItemId, hydratedEvents);
        }

        return result;
    }

    private buildEventTimestampMap(attributions: AttributionWithRef[]): Map<string, Date> {
        const eventTimestampMap = new Map<string, Date>();
        for (const attr of attributions) {
            const identifiableRef = attr.source_item_ref;
            if (!identifiableRef) continue;
            
            const entityType = parseHydratorType(identifiableRef.entity_type);
            if (!entityType) continue;
            
            const entityId = identifiableRef.entity_id;
            const key = `${entityType}:${entityId}`;
            
            const existingTimestamp = eventTimestampMap.get(key);
            if (!existingTimestamp || attr.created_at < existingTimestamp) {
                eventTimestampMap.set(key, attr.created_at);
            }
        }
        return eventTimestampMap;
    }

    private extractUniqueIdentifiables(attributions: AttributionWithRef[]): Identifiable[] {
        const identifiableRefs: Identifiable[] = attributions
            .map(attr => {
                const identifiableRef = attr.source_item_ref;
                if (!identifiableRef) {
                    return null;
                }
                const entityType = parseHydratorType(identifiableRef.entity_type);
                if (!entityType) {
                    return null;
                }
                return {
                    entityType,
                    entityId: identifiableRef.entity_id
                };
            })
            .filter((ref): ref is Identifiable => ref !== null);

        // Remove duplicates
        return Array.from(
            new Map(identifiableRefs.map(ref => [`${ref.entityType}:${ref.entityId}`, ref])).values()
        );
    }

    private async hydrateEvents(identifiableRefs: Identifiable[]): Promise<HydratedEvent[]> {
        // Group by entity type to hydrate efficiently
        const groupedByType = identifiableRefs.reduce((acc, ref) => {
            if (!acc[ref.entityType]) {
                acc[ref.entityType] = [];
            }
            acc[ref.entityType].push(ref);
            return acc;
        }, {} as Record<HydratorType, Identifiable[]>);

        // Hydrate all events
        const hydratedEvents: HydratedEvent[] = [];
        for (const [entityType, refs] of Object.entries(groupedByType)) {
            try {
                const parsedType = parseHydratorType(entityType);
                if (!parsedType) { continue; }
                const hydrator = getHydrator(parsedType, this.ctx);
                if (!hydrator) { continue; }
                const events = await hydrator.hydrateBulk(refs);
                hydratedEvents.push(...events);
            } catch (error) {
                // Fail silently - continue with other types
            }
        }

        return hydratedEvents;
    }

    private sortEventsByTimestamp(
        events: HydratedEvent[],
        timestampMap: Map<string, Date>
    ): HydratedEvent[] {
        return [...events].sort((a, b) => {
            const keyA = `${a.entityType}:${a.entityId}`;
            const keyB = `${b.entityType}:${b.entityId}`;
            const timestampA = timestampMap.get(keyA);
            const timestampB = timestampMap.get(keyB);
            
            if (!timestampA && !timestampB) return 0;
            if (!timestampA) return 1;
            if (!timestampB) return -1;
            
            return timestampA.getTime() - timestampB.getTime();
        });
    }

    private async processAttributions(attributions: AttributionWithRef[]): Promise<HydratedEvent[]> {
        if (attributions.length === 0) {
            return [];
        }

        const eventTimestampMap = this.buildEventTimestampMap(attributions);
        const uniqueRefs = this.extractUniqueIdentifiables(attributions);
        const hydratedEvents = await this.hydrateEvents(uniqueRefs);
        return this.sortEventsByTimestamp(hydratedEvents, eventTimestampMap);
    }
}

