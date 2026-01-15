import { EventEmitterTaskQueue } from '../tasks/abstract/eventEmitterTasks';
import { IntegrationCompletedTask } from './IntegrationCompletedTask';
import { IntegrationFormCompletedTask } from './IntegrationFormCompletedTask';

/**
 * Task queue for integration-related events
 * This file only exports the queues without any handlers to avoid circular dependencies.
 * Handlers are registered in IntegrationTaskHandler.ts
 */
export const integrationTaskQueue = new EventEmitterTaskQueue<IntegrationCompletedTask>();

/**
 * Task queue for integration form completion events
 * This file only exports the queues without any handlers to avoid circular dependencies.
 * Handlers are registered in IntegrationTaskHandler.ts
 */
export const integrationFormTaskQueue = new EventEmitterTaskQueue<IntegrationFormCompletedTask>();
