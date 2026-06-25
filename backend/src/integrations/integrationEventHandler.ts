import { IntegrationType } from "terse-types/Integrations"

import { trackIntegrationAdded } from "../common/analytics"
import logger from "../common/logger"

/**
 * Minimal, serializable payload for an "integration added" event. Carried as BullMQ job data
 * (prod) or passed in-process (no-Redis dev). Must contain only what the handler needs.
 */
export interface IntegrationCompletedJobData {
    integrationType: IntegrationType
    integrationId: string
    userId: string
}

/** Shared handler invoked by both the BullMQ worker and the in-process dev fallback. */
export function handleIntegrationCompleted(data: IntegrationCompletedJobData): void {
    try {
        trackIntegrationAdded(data.userId, { integrationType: data.integrationType })
    } catch (error) {
        logger.error("Error handling integration completed event", {
            error,
            integrationType: data.integrationType,
            integrationId: data.integrationId,
            userId: data.userId
        })
    }
}
