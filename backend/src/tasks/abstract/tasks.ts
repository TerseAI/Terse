/**
 * Interfaces for a basic task system. Implement these interfaces to create a task system,
 * simplifies swapping in a full fledged task queue in the future.
 */

export interface Task {
    taskName: string
}

export interface TaskListener<T extends Task> {
    taskName: string
    onTask(task: T): void | Promise<void>
}

interface TaskEmitter<T extends Task> {
    /** Resolves once the signal is published; rejects if it could not be delivered. */
    emit(task: T): Promise<void>
}

export interface WaitForOptions {
    timeoutMs?: number
}

/** Cleanup function returned by addListener - call to unsubscribe */
export type Unsubscribe = () => void

export interface TaskQueue<T extends Task> extends TaskEmitter<T> {
    addListener(listener: TaskListener<T>): Unsubscribe
    removeListener(listener: TaskListener<T>): void
    waitFor(taskName: string, predicate: (task: T) => boolean, options?: WaitForOptions): Promise<T>
}
