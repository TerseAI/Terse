import { SdkListenForwardedEvent } from "terse-types"

import { RedisTaskQueue } from "../../tasks/abstract/redisTaskQueue"
import { Task } from "../../tasks/abstract/tasks"

interface ListenForwardedTask extends Task {
    event: SdkListenForwardedEvent
}

const queue = new RedisTaskQueue<ListenForwardedTask>("listen")

export function emitListenForwardedEvent(organizationId: string, event: SdkListenForwardedEvent): void {
    queue.emit({ taskName: organizationId, event })
}

export function onListenForwardedEvent(organizationId: string, listener: (event: SdkListenForwardedEvent) => void): () => void {
    return queue.addListener({
        taskName: organizationId,
        onTask: task => listener(task.event)
    })
}
