import { USER_CANCELLED_REASON } from "../../socketHandlers/activeExecution"
import { EventEmitterTaskQueue } from "../../tasks/abstract/eventEmitterTasks"
import { Task } from "../../tasks/abstract/tasks"

const BUILDER_CHAT_CANCELLATION_TASK_NAME = "BUILDER_CHAT_CANCELLATION_TASK" as const

class BuilderChatCancellationTask implements Task {
    readonly taskName = BUILDER_CHAT_CANCELLATION_TASK_NAME

    constructor(
        public sessionId: string,
        public reason: string = USER_CANCELLED_REASON
    ) {}
}

const builderChatCancellationTaskQueue = new EventEmitterTaskQueue<BuilderChatCancellationTask>()

type BuilderChatCancellationSubscription = {
    isCancellationRequested: () => boolean
    unsubscribe: () => void
}

export function requestBuilderChatCancellation(sessionId: string, reason: string = USER_CANCELLED_REASON): void {
    builderChatCancellationTaskQueue.emit(new BuilderChatCancellationTask(sessionId, reason))
}

export function listenForBuilderChatCancellation(sessionId: string, controller: AbortController): BuilderChatCancellationSubscription {
    let cancellationRequested = false

    const unsubscribe = builderChatCancellationTaskQueue.addListener({
        taskName: BUILDER_CHAT_CANCELLATION_TASK_NAME,
        onTask: task => {
            if (task.sessionId !== sessionId) {
                return
            }

            cancellationRequested = true
            controller.abort(task.reason)
        }
    })

    return {
        isCancellationRequested: () => cancellationRequested,
        unsubscribe
    }
}
