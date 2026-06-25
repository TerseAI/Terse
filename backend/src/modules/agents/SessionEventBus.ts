import { SdkAgentStreamEvent } from "terse-types/types"

import { createTaskQueue } from "../../tasks/abstract/taskQueueFactory"
import { Task } from "../../tasks/abstract/tasks"

interface SessionEventTask extends Task {
    event: SdkAgentStreamEvent
}

const queue = createTaskQueue<SessionEventTask>("session")

export function emitSessionEvent(sessionId: string, event: SdkAgentStreamEvent): void {
    queue.emit({ taskName: sessionId, event })
}

export function onSessionEvent(sessionId: string, listener: (event: SdkAgentStreamEvent) => void): () => void {
    return queue.addListener({
        taskName: sessionId,
        onTask: task => listener(task.event)
    })
}
