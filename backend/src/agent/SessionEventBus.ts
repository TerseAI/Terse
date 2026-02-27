import { SdkAgentStreamEvent } from "../shared/types"
import { EventEmitterTaskQueue } from "../tasks/abstract/eventEmitterTasks"
import { Task } from "../tasks/abstract/tasks"

export interface SessionEventTask extends Task {
    event: SdkAgentStreamEvent
}

const queue = new EventEmitterTaskQueue<SessionEventTask>()

export function emitSessionEvent(sessionId: string, event: SdkAgentStreamEvent): void {
    queue.emit({ taskName: sessionId, event })
}

export function onSessionEvent(sessionId: string, listener: (event: SdkAgentStreamEvent) => void): () => void {
    return queue.addListener({
        taskName: sessionId,
        onTask: (task) => listener(task.event)
    })
}
