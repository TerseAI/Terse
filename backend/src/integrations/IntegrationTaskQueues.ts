import logger from "../common/logger"
import { getQueue, isQueueRedisConfigured } from "../loaders/bullmq"
import { EventEmitterTaskQueue } from "../tasks/abstract/eventEmitterTasks"
import { QueueName } from "../tasks/queues/queueNames"

import { IntegrationCompletedTask } from "./IntegrationCompletedTask"
import { IntegrationCompletedJobData } from "./integrationEventHandler"

/**
 * Producer facade for "integration added" events.
 *
 * This is exactly-once "do this work" (track analytics), NOT a fan-out signal, so it must be a work
 * queue: when the queue Redis is configured we enqueue a BullMQ job consumed by the worker. When it
 * isn't (local dev without Redis), we fall back to in-process delivery so analytics still fire.
 *
 * Enqueue is best-effort and fire-and-forget: a Redis outage must not break the OAuth completion
 * flow, so we log rather than throw (unlike the run-execution path, which must throw).
 *
 * Handlers: the BullMQ worker (prod) and IntegrationTaskHandler's in-process listener (dev) both
 * call the shared handleIntegrationCompleted.
 */
const inProcessQueue = new EventEmitterTaskQueue<IntegrationCompletedTask>()

export const integrationTaskQueue = {
    emit(task: IntegrationCompletedTask): void {
        if (isQueueRedisConfigured()) {
            const data: IntegrationCompletedJobData = {
                integrationType: task.integrationType,
                integrationId: task.integrationId,
                userId: task.userId
            }
            void getQueue(QueueName.IntegrationEvents)
                .add(task.taskName, data, { removeOnComplete: true, removeOnFail: 1000 })
                .catch(error => logger.error("Failed to enqueue integration completed event", { error, integrationType: task.integrationType }))
            return
        }
        inProcessQueue.emit(task)
    },

    addListener: inProcessQueue.addListener.bind(inProcessQueue)
}
