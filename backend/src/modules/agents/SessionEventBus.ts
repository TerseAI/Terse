import { SdkAgentStreamEvent } from "terse-types/types"

import logger from "../../common/logger"
import { RedisTaskQueue } from "../../tasks/abstract/redisTaskQueue"
import { Task } from "../../tasks/abstract/tasks"

interface SessionEventTask extends Task {
    event: SdkAgentStreamEvent
}

const queue = new RedisTaskQueue<SessionEventTask>("session")

/** Fire-and-forget: losing a stream event degrades the live view but must not fail the caller. */
export function emitSessionEvent(sessionId: string, event: SdkAgentStreamEvent): void {
    queue.emit({ taskName: sessionId, event }).catch(error => logger.error("Failed to publish session event", { error, sessionId }))
}

export function onSessionEvent(sessionId: string, listener: (event: SdkAgentStreamEvent) => void): () => void {
    return queue.addListener({
        taskName: sessionId,
        onTask: task => listener(task.event)
    })
}
