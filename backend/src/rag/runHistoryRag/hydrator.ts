import { db } from "../../prismaClient"
import { RunHistoryRawEventWithRelations } from "../../types/prisma"
import { HydrationContext, Hydrator, Identifiable, WithIdentity } from "../Hydrator"

export type IdentifiableRunHistoryRawEvent = WithIdentity<RunHistoryRawEventWithRelations>

export class RunHistoryRawEventHydrator extends Hydrator<IdentifiableRunHistoryRawEvent> {
    readonly entityType = "run_history_raw_event"

    constructor(ctx: HydrationContext) {
        super(ctx)
    }

    async hydrate(ref: Identifiable): Promise<IdentifiableRunHistoryRawEvent> {
        // Org scope is required — without it any authenticated tenant could
        // request another org's run_history_raw_events by id. Sibling
        // GithubEventHydrator fails closed the same way.
        if (!this.ctx.organizationId) {
            throw new Error("Run history raw event hydrator requires organizationId in context")
        }
        const event = await db().run_history_raw_events.findFirst({
            where: {
                id: ref.entityId,
                run_history_record: { automation: { organization_id: this.ctx.organizationId } }
            },
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
        if (!this.ctx.organizationId) {
            throw new Error("Run history raw event hydrator requires organizationId in context")
        }
        const ids = refs.map(ref => ref.entityId)

        const events = await db().run_history_raw_events.findMany({
            where: {
                id: { in: ids },
                run_history_record: { automation: { organization_id: this.ctx.organizationId } }
            },
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
