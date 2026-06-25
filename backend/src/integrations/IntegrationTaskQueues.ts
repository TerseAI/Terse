import { EventEmitterTaskQueue } from "../tasks/abstract/eventEmitterTasks"

import { IntegrationCompletedTask } from "./IntegrationCompletedTask"

/**
 * Task queue for integration-related events.
 * Exports the queue without handlers to avoid circular dependencies.
 * Handlers are registered in IntegrationTaskHandler.ts.
 *
 * This is exactly-once "do this work" (track analytics on integration added), NOT a fan-out
 * signal, so it stays in-process here rather than going through cross-instance pub/sub (which
 * would fire the handler on every instance → duplicate analytics). Phase 2 moves it to a BullMQ
 * job consumed by the worker.
 */
export const integrationTaskQueue = new EventEmitterTaskQueue<IntegrationCompletedTask>()
