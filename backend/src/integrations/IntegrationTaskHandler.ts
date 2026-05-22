import { trackIntegrationAdded } from "../common/analytics"
import logger from "../common/logger"

import { INTEGRATION_COMPLETED_TASK_NAME, IntegrationCompletedTask } from "./IntegrationCompletedTask"
import { integrationTaskQueue } from "./IntegrationTaskQueues"

/**
 * Register listener for integration completed tasks (OAuth).
 * Tracks analytics when an integration is added.
 */
integrationTaskQueue.addListener({
    taskName: INTEGRATION_COMPLETED_TASK_NAME,
    onTask: async (task: IntegrationCompletedTask) => {
        try {
            trackIntegrationAdded(task.userId, {
                integrationType: task.integrationType
            })
        } catch (error) {
            logger.error("Error in integration completion task handler", {
                error,
                integrationType: task.integrationType,
                integrationId: task.integrationId,
                userId: task.userId
            })
        }
    }
})

logger.info("Integration task handler listener registered")
