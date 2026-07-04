import { SdkListenForwardedEvent } from "terse-types"

import logger from "../../common/logger"
import { RedisTaskQueue } from "../../tasks/abstract/redisTaskQueue"
import { Task } from "../../tasks/abstract/tasks"

interface ListenForwardedTask extends Task {
    event: SdkListenForwardedEvent
}

const queue = new RedisTaskQueue<ListenForwardedTask>("listen")

/** Fire-and-forget: losing a forwarded event degrades `terse listen` output but must not fail the caller. */
export function emitListenForwardedEvent(organizationId: string, event: SdkListenForwardedEvent): void {
    queue.emit({ taskName: organizationId, event }).catch(error => logger.error("Failed to publish listen event", { error, organizationId }))
}

export function onListenForwardedEvent(organizationId: string, listener: (event: SdkListenForwardedEvent) => void): () => void {
    return queue.addListener({
        taskName: organizationId,
        onTask: task => listener(task.event)
    })
}
