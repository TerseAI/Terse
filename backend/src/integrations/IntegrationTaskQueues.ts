import logger from "../common/logger"
import { getQueue } from "../loaders/bullmq"
import { QueueName } from "../tasks/queues/queueNames"

import { IntegrationCompletedTask } from "./IntegrationCompletedTask"
import { IntegrationCompletedJobData } from "./integrationEventHandler"

/**
 * Producer for "integration added" events. Enqueues a BullMQ job consumed by the worker (exactly
 * once). Best-effort and fire-and-forget: a Redis hiccup must not break the OAuth completion flow,
 * so we log rather than throw.
 */
export const integrationTaskQueue = {
    emit(task: IntegrationCompletedTask): void {
        const data: IntegrationCompletedJobData = {
            integrationType: task.integrationType,
            integrationId: task.integrationId,
            userId: task.userId
        }
        void getQueue(QueueName.IntegrationEvents)
            .add(task.taskName, data, { removeOnComplete: true, removeOnFail: 1000 })
            .catch(error => logger.error("Failed to enqueue integration completed event", { error, integrationType: task.integrationType }))
    }
}
