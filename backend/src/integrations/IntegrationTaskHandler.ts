import logger from "../logger"
import { trackIntegrationAdded } from "../utility/analytics"

import { INTEGRATION_COMPLETED_TASK_NAME, IntegrationCompletedTask } from "./IntegrationCompletedTask"
import { INTEGRATION_FORM_COMPLETED_TASK_NAME, IntegrationFormCompletedTask } from "./IntegrationFormCompletedTask"
import { integrationFormTaskQueue, integrationTaskQueue } from "./IntegrationTaskQueues"

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

/**
 * Register listener for integration form completion tasks.
 * Tracks analytics when an integration form is completed.
 */
integrationFormTaskQueue.addListener({
    taskName: INTEGRATION_FORM_COMPLETED_TASK_NAME,
    onTask: async (task: IntegrationFormCompletedTask) => {
        try {
            trackIntegrationAdded(task.userId, {
                integrationType: task.integrationType
            })
        } catch (error) {
            logger.error("Error in integration form completion task handler", {
                error,
                integrationType: task.integrationType,
                integrationId: task.integrationId,
                userId: task.userId
            })
        }
    }
})

logger.info("Integration form task handler listener registered")
