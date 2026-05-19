import { EventEmitterTaskQueue } from "../tasks/abstract/eventEmitterTasks"

import { IntegrationCompletedTask } from "./IntegrationCompletedTask"

/**
 * Task queue for integration-related events.
 * Exports the queue without handlers to avoid circular dependencies.
 * Handlers are registered in IntegrationTaskHandler.ts.
 */
export const integrationTaskQueue = new EventEmitterTaskQueue<IntegrationCompletedTask>()
