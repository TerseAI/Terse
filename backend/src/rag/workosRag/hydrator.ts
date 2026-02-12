import { WorkOSEvent, WorkOSWebhookPayload } from "../../integrations/WorkOSIntegration"
import logger from "../../logger"
import { db } from "../../prismaClient"
import { HydratorType } from "../../types/rag"
import { HydrationContext, Hydrator, Identifiable } from "../Hydrator"

export class WorkOSEventHydrator extends Hydrator<WorkOSEvent> {
    readonly entityType = HydratorType.WORKOS_EVENT

    constructor(ctx: HydrationContext) {
        super(ctx)
    }

    async hydrate(ref: Identifiable): Promise<WorkOSEvent> {
        const event = await this.fetchFromWorkOS(ref.entityId)
        if (!event) {
            throw new Error(`Failed to hydrate WorkOS event: ${ref.entityId}`)
        }
        return event
    }

    async hydrateBulk(refs: Identifiable[]): Promise<WorkOSEvent[]> {
        const results = await Promise.all(refs.map(ref => this.fetchFromWorkOS(ref.entityId)))
        return results.map((event, i) => {
            if (!event) {
                throw new Error(`Failed to hydrate WorkOS event: ${refs[i].entityId}`)
            }
            return event
        })
    }

    private async fetchFromWorkOS(entityId: string): Promise<WorkOSEvent | null> {
        // entityId format: "integrationId:eventId"
        const colonIndex = entityId.indexOf(":")
        if (colonIndex === -1) {
            logger.error(`Invalid WorkOS entityId format: ${entityId}`)
            return null
        }
        const integrationId = entityId.substring(0, colonIndex)
        const eventId = entityId.substring(colonIndex + 1)

        if (!this.ctx.organizationId) {
            logger.error("WorkOS hydrator requires organizationId in context")
            return null
        }

        const integration = await db().workos_integrations.findFirst({
            where: {
                id: integrationId,
                organization_id: this.ctx.organizationId
            }
        })
        if (!integration?.api_key) {
            logger.error(`WorkOS integration ${integrationId} not found or missing API key`)
            return null
        }

        try {
            // WorkOS doesn't have a single-event GET endpoint, so we use the
            // list endpoint and scan for the matching event ID.
            // The `events` parameter is required by the WorkOS API.
            const SUPPORTED_EVENT_TYPES = ["user.created", "user.updated", "user.deleted", "organization_membership.created", "organization_membership.updated", "organization_membership.deleted"]
            const MAX_PAGES = 3
            const PAGE_SIZE = 50
            let after: string | undefined

            for (let page = 0; page < MAX_PAGES; page++) {
                const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
                for (const eventType of SUPPORTED_EVENT_TYPES) {
                    params.append("events", eventType)
                }
                if (after) {
                    params.set("after", after)
                }

                const response = await fetch(`https://api.workos.com/events?${params.toString()}`, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${integration.api_key}`,
                        "Content-Type": "application/json"
                    }
                })

                if (!response.ok) {
                    logger.error(`WorkOS events list failed during hydration`, { status: response.status, eventId })
                    return null
                }

                const json = (await response.json()) as {
                    data: WorkOSWebhookPayload[]
                    list_metadata: { after: string | null }
                }

                const match = json.data.find(evt => evt.id === eventId)
                if (match) {
                    return new WorkOSEvent(match, integrationId)
                }

                // No more pages
                if (!json.list_metadata.after) {
                    break
                }
                after = json.list_metadata.after
            }

            logger.warn(`WorkOS event ${eventId} not found after scanning ${MAX_PAGES} pages`, { entityId })
            return null
        } catch (error) {
            logger.error(`Failed to fetch WorkOS event ${eventId}`, { error, entityId })
            return null
        }
    }
}
