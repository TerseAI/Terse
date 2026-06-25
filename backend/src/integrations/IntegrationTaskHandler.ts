import logger from "../common/logger"

import { INTEGRATION_COMPLETED_TASK_NAME, IntegrationCompletedTask } from "./IntegrationCompletedTask"
import { integrationTaskQueue } from "./IntegrationTaskQueues"
import { handleIntegrationCompleted } from "./integrationEventHandler"

/**
 * In-process handler for integration completed tasks (OAuth analytics). Only fires on the no-Redis
 * dev path; when the queue Redis is configured the BullMQ worker consumes these instead (see
 * IntegrationTaskQueues + worker.ts).
 */
integrationTaskQueue.addListener({
    taskName: INTEGRATION_COMPLETED_TASK_NAME,
    onTask: (task: IntegrationCompletedTask) =>
        handleIntegrationCompleted({
            integrationType: task.integrationType,
            integrationId: task.integrationId,
            userId: task.userId
        })
})

logger.info("Integration task handler listener registered")
