import { USER_CANCELLED_REASON } from "../../socketHandlers/activeExecution"
import { EventEmitterTaskQueue } from "../../tasks/abstract/eventEmitterTasks"
import { Task } from "../../tasks/abstract/tasks"

const RUN_CANCELLATION_TASK_NAME = "RUN_CANCELLATION_TASK" as const

class RunCancellationTask implements Task {
    readonly taskName = RUN_CANCELLATION_TASK_NAME

    constructor(
        public runId: string,
        public reason: string = USER_CANCELLED_REASON
    ) {}
}

const runCancellationTaskQueue = new EventEmitterTaskQueue<RunCancellationTask>()

type RunCancellationSubscription = {
    isCancellationRequested: () => boolean
    unsubscribe: () => void
}

export function requestRunCancellation(runId: string, reason: string = USER_CANCELLED_REASON): void {
    runCancellationTaskQueue.emit(new RunCancellationTask(runId, reason))
}

export function listenForRunCancellation(runId: string, controller: AbortController): RunCancellationSubscription {
    let cancellationRequested = false

    const unsubscribe = runCancellationTaskQueue.addListener({
        taskName: RUN_CANCELLATION_TASK_NAME,
        onTask: task => {
            if (task.runId !== runId) {
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
