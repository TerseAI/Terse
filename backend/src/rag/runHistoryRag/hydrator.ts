import { Hydrator } from "../Hydrator";
import { db } from "../../prismaClient";
import { RunHistoryRawEventWithRelations } from "../../types/prisma";
import { HydratorType } from "../../types/rag";
import { RunHistoryMetadata } from "./indexer";
import { SearchItem } from "../searchTypes";

export class RunHistoryRawEventHydrator implements Hydrator<RunHistoryRawEventWithRelations> {
    entityType = HydratorType.RUN_HISTORY_RAW_EVENT;

    async hydrate(searchItem: SearchItem<RunHistoryMetadata>): Promise<RunHistoryRawEventWithRelations> {
        const event = await db().run_history_raw_events.findUnique({
            where: { id: searchItem.entityId },
            include: {
                run_history_record: {
                    include: {
                        automation: true
                    }
                }
            }
        });
        
        if (!event) {
            throw new Error(`Run history raw event not found: ${searchItem.entityId}`);
        }

        return event as RunHistoryRawEventWithRelations;
    }

    async hydrateBulk(searchItems: SearchItem<RunHistoryMetadata>[]): Promise<RunHistoryRawEventWithRelations[]> {
        const ids = searchItems.map(item => item.entityId);
        
        const events = await db().run_history_raw_events.findMany({
            where: { id: { in: ids } },
            include: {
                run_history_record: {
                    include: {
                        automation: true
                    }
                }
            }
        });

        // Create a map for O(1) lookup
        const eventMap = new Map(events.map(e => [e.id, e]));

        // Return in the same order as searchItems, handling missing events
        return searchItems.map(item => {    
            const event = eventMap.get(item.entityId);
            if (!event) {
                throw new Error(`Run history raw event not found: ${item.entityId}`);
            }
            return event as RunHistoryRawEventWithRelations;
        });
    }
}