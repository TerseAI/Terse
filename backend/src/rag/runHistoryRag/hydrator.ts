import { db } from "../../prismaClient"
import { RunHistoryRawEventWithRelations } from "../../types/prisma"
import { HydratorType } from "../../types/rag"
import { HydrationContext, Hydrator, Identifiable, WithIdentity } from "../Hydrator"

export type IdentifiableRunHistoryRawEvent = WithIdentity<RunHistoryRawEventWithRelations>

export class RunHistoryRawEventHydrator extends Hydrator<IdentifiableRunHistoryRawEvent> {
    readonly entityType = HydratorType.RUN_HISTORY_RAW_EVENT

    constructor(ctx: HydrationContext) {
        super(ctx)
    }

    async hydrate(ref: Identifiable): Promise<IdentifiableRunHistoryRawEvent> {
        const event = await db().run_history_raw_events.findUnique({
            where: { id: ref.entityId },
            include: {
                run_history_record: {
                    include: {
                        automation: true
                    }
                }
            }
        })

        if (!event) {
            throw new Error(`Run history raw event not found: ${ref.entityId}`)
        }

        return {
            ...event,
            entityType: this.entityType,
            entityId: event.id
        }
    }

    async hydrateBulk(refs: Identifiable[]): Promise<IdentifiableRunHistoryRawEvent[]> {
        const ids = refs.map(ref => ref.entityId)

        const events = await db().run_history_raw_events.findMany({
            where: { id: { in: ids } },
            include: {
                run_history_record: {
                    include: {
                        automation: true
                    }
                }
            }
        })

        // Create a map for O(1) lookup
        const eventMap = new Map(events.map(e => [e.id, e]))

        // Return in the same order as refs, handling missing events
        return refs.map(ref => {
            const event = eventMap.get(ref.entityId)
            if (!event) {
                throw new Error(`Run history raw event not found: ${ref.entityId}`)
            }
            return {
                ...event,
                entityType: this.entityType,
                entityId: event.id
            }
        })
    }
}
