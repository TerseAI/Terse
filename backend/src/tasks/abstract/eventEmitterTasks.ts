import EventEmitter from "node:events"

import { Task, TaskListener, TaskQueue, Unsubscribe, WaitForOptions } from "./tasks"

export class EventEmitterTaskQueue<T extends Task> implements TaskQueue<T> {
    private emitter = new EventEmitter()

    addListener(listener: TaskListener<T>): Unsubscribe {
        this.emitter.on(listener.taskName, listener.onTask)
        return () => this.removeListener(listener)
    }

    removeListener(listener: TaskListener<T>): void {
        this.emitter.off(listener.taskName, listener.onTask)
    }

    emit(task: T): void {
        this.emitter.emit(task.taskName, task)
    }

    waitFor(taskName: string, predicate: (task: T) => boolean, options?: WaitForOptions): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            let timeout: NodeJS.Timeout | undefined

            const listener: TaskListener<T> = {
                taskName,
                onTask: (task: T) => {
                    if (!predicate(task)) return

                    if (timeout) clearTimeout(timeout)
                    this.removeListener(listener)
                    resolve(task)
                }
            }

            if (options?.timeoutMs) {
                timeout = setTimeout(() => {
                    this.removeListener(listener)
                    reject(new Error(`waitFor("${taskName}") timed out after ${options.timeoutMs}ms`))
                }, options.timeoutMs)
            }

            this.addListener(listener)
        })
    }
}
