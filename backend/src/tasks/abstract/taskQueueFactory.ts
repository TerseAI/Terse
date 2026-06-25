/**
 * Selects the TaskQueue backing at construction time:
 *  - RedisTaskQueue (cross-instance pub/sub) when the queue Redis is configured.
 *  - EventEmitterTaskQueue (single-process) otherwise — for a no-Redis local checkout.
 *
 * This is a config-time choice, NOT a runtime degrade: once Redis is configured it is a hard
 * dependency and there is no fallback if it later goes down.
 *
 * `namespace` scopes the Redis channels per call site so dynamic-keyed buses (e.g. sessionId,
 * organizationId) cannot collide across buses.
 */
import { isQueueRedisConfigured } from "../../loaders/bullmq"

import { EventEmitterTaskQueue } from "./eventEmitterTasks"
import { RedisTaskQueue } from "./redisTaskQueue"
import { Task, TaskQueue } from "./tasks"

export function createTaskQueue<T extends Task>(namespace: string): TaskQueue<T> {
    if (isQueueRedisConfigured()) {
        return new RedisTaskQueue<T>(namespace)
    }
    return new EventEmitterTaskQueue<T>()
}
