import type { ConfigData, SdkSampleEventRef as SampleEventRef, SdkSampleEventsResponse } from "terse-types"
import { IntegrationType } from "terse-types"

import logger from "../../common/logger"
import { fetchWebhookSampleEvents } from "../../common/webhookSampleEvents"
import { validateUserOwnsIntegration } from "../../modules/agents/controller"

import { IntegrationRegistry } from "./IntegrationRegistry"

export type FetchSampleEventsOptions = {
    integrationId: string
    integrationType: IntegrationType
    triggerConfig: ConfigData
    organizationId: string
    userId: string
    triggerId?: string
    jobName?: string
    projectId?: string
    limit?: number
}

/**
 * Fetch sample events for a single trigger. Routes to the right integration manager,
 * or to the webhook past-event store for webhook triggers (which have no manager).
 */
export async function fetchSampleEvents(opts: FetchSampleEventsOptions): Promise<SdkSampleEventsResponse> {
    const { integrationType, integrationId, triggerConfig, organizationId, userId, triggerId, jobName, projectId } = opts
    const limit = opts.limit ?? 5

    if (integrationType === IntegrationType.WEBHOOK) {
        if (!jobName || !projectId) {
            logger.warn("[fetchSampleEvents] Webhook trigger requires jobName + projectId; skipping")
            return { events: [] }
        }
        return fetchWebhookSampleEvents({ jobName, projectId, organizationId })
    }

    const manager = IntegrationRegistry.getInstance()
        .all()
        .find(m => m.integrationType === integrationType)
    if (!manager || !manager.getSampleEvents) {
        logger.warn("[fetchSampleEvents] Integration does not support sample events", { integrationType })
        throw new Error(`Integration ${integrationType} does not support sample events`)
    }

    const ownsIntegration = await validateUserOwnsIntegration(organizationId, integrationType, integrationId)
    if (!ownsIntegration) {
        throw new Error(`Integration ${integrationType} not found or not in your organization`)
    }

    const inputEvents = await manager.getSampleEvents(integrationId, organizationId, userId, triggerConfig, { limit, triggerId })
    logger.info("[fetchSampleEvents] Fetched raw events from integration", {
        integrationType,
        count: inputEvents.length
    })

    const events: SampleEventRef[] = []
    for (const evt of inputEvents) {
        const identifiable = evt.getIdentifiableInfo()
        if (!identifiable) {
            logger.warn("[fetchSampleEvents] Skipping non-hydratable sample runtime", {
                integrationType,
                eventType: evt.eventType
            })
            continue
        }
        events.push({ entity: identifiable, serializedEvent: evt.getSerializedEvent() })
    }

    return { events }
}
