import { WebMonitorTriggerRuntime, getEventGroup, getMonitor } from "../../integrations/WebMonitorIntegration"
import logger from "../../logger"
import { HydratorType } from "../../types/rag"
import { HydrationContext, Hydrator, Identifiable } from "../Hydrator"

export class WebMonitorEventHydrator extends Hydrator<WebMonitorTriggerRuntime> {
    readonly entityType = HydratorType.WEBMONITOR_EVENT

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
            logger.error(`Invalid WebMonitor entityId format: ${entityId}`)
            return null
        }
        const [monitorId, eventGroupId, encodedEventDate] = parts
        const eventDate = decodeURIComponent(encodedEventDate)

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
            logger.error(`Failed to hydrate WebMonitor entityId: ${entityId}`, { error })
            return null
        }
    }
}
