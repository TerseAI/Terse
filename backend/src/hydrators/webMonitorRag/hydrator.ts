import { WebMonitorTriggerRuntime, getEventGroup, getMonitor } from "../../integrations/WebMonitorIntegration"
import logger from "../../common/logger"
import { db } from "../../loaders/prisma"
import { HydrationContext, HydrationError, Hydrator, Identifiable } from "../Hydrator"

export class WebMonitorEventHydrator extends Hydrator<WebMonitorTriggerRuntime> {
    readonly entityType = "webmonitor_event"

    constructor(ctx: HydrationContext) {
        super(ctx)
    }

    async hydrate(ref: Identifiable): Promise<WebMonitorTriggerRuntime> {
        const event = await this.fetchFromWebMonitor(ref.entityId)
        if (!event) {
            throw new Error(`Failed to hydrate WebMonitor event: ${ref.entityId}`)
        }
        return event
    }

    async hydrateBulk(refs: Identifiable[]): Promise<WebMonitorTriggerRuntime[]> {
        const results = await Promise.all(refs.map(ref => this.fetchFromWebMonitor(ref.entityId)))
        return results.map((event, i) => {
            if (!event) {
                throw new Error(`Failed to hydrate WebMonitor event: ${refs[i].entityId}`)
            }
            return event
        })
    }

    private async fetchFromWebMonitor(entityId: string): Promise<WebMonitorTriggerRuntime | null> {
        const parts = entityId.split(":")
        if (parts.length < 3) {
            throw new HydrationError(400, "Invalid web monitor entity id")
        }
        const [monitorId, eventGroupId, encodedEventDate] = parts
        const eventDate = decodeURIComponent(encodedEventDate)

        await this.assertOrganizationAccess(monitorId)

        try {
            const [monitorConfig, events] = await Promise.all([getMonitor(monitorId), getEventGroup(monitorId, eventGroupId)])
            const event = events.find(candidate => candidate.event_date === eventDate) ?? events[0]
            if (!event) {
                logger.error(`No events found for WebMonitor entityId: ${entityId}`)
                return null
            }

            return new WebMonitorTriggerRuntime({
                inputId: "sample",
                automationId: "sample",
                query: monitorConfig.query,
                frequency: monitorConfig.frequency,
                monitorId,
                eventGroupId,
                metadata: {},
                event
            })
        } catch (error) {
            if (error instanceof HydrationError) {
                throw error
            }
            logger.error(`Failed to hydrate WebMonitor entityId: ${entityId}`, { error })
            return null
        }
    }

    private async assertOrganizationAccess(monitorId: string): Promise<void> {
        const organizationId = this.ctx.organizationId
        if (!organizationId) {
            throw new HydrationError(403, "Forbidden")
        }

        const hasAccess = await db().automation_webmonitor_configs.findFirst({
            where: {
                provider_monitor_id: monitorId,
                automation_input: {
                    automation: {
                        organization_id: organizationId
                    }
                }
            },
            select: { id: true }
        })

        if (!hasAccess) {
            throw new HydrationError(403, "Forbidden")
        }
    }
}
