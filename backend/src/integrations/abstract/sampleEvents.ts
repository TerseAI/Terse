import type { ConfigData } from "terse-types"
import { IntegrationType } from "terse-types"

import logger from "../../logger"
import { validateUserOwnsIntegration } from "../../routes/agents"

import { INTEGRATION_REGISTRY } from "./IntegrationRegistry"
import type { TriggerRuntime } from "./TriggerRuntime"

/**
 * Fetch sample events for a given integration trigger config.
 * Extracted from ChatAgentTools.ts so it can be reused by the SDK endpoint.
 */
export async function fetchSampleEvents(
    integrationId: string,
    integrationType: IntegrationType,
    triggerConfig: ConfigData,
    organizationId: string,
    userId: string,
    options?: { limit?: number; triggerId?: string }
): Promise<TriggerRuntime[]> {
    const limit = options?.limit ?? 5

    const manager = INTEGRATION_REGISTRY.find(m => m.integrationType === integrationType)
    if (!manager || !manager.getSampleEvents) {
        logger.warn("[fetchSampleEvents] Integration does not support sample events", { integrationType })
        throw new Error(`Integration ${integrationType} does not support sample events`)
    }

    const ownsIntegration = await validateUserOwnsIntegration(organizationId, integrationType, integrationId)
    if (!ownsIntegration) {
        throw new Error(`Integration ${integrationType} not found or not in your organization`)
    }

    const inputEvents = await manager.getSampleEvents(integrationId, organizationId, userId, triggerConfig, { limit, triggerId: options?.triggerId })
    logger.info("[fetchSampleEvents] Fetched raw events from integration", {
        integrationType,
        count: inputEvents.length
    })

    return inputEvents
}
