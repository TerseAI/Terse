import { EventEmitterTaskQueue } from "../../../tasks/abstract/eventEmitterTasks"
import { Task } from "../../../tasks/abstract/tasks"

const CANCELLATION_TASK_NAME = "CANCELLATION_TASK" as const

export enum CancelReason {
    USER_CANCELLED = "user_cancelled",
    BILLING_OVERAGE = "billing_overage",
    HARD_REJECT = "hard_reject"
}

class CancellationTask implements Task {
    readonly taskName = CANCELLATION_TASK_NAME

    constructor(
        public organizationId: string,
        public runId: string | undefined,
        public reason: CancelReason
    ) {}
}

const cancellationTaskQueue = new EventEmitterTaskQueue<CancellationTask>()

type RunCancellationSubscription = {
    isCancellationRequested: () => boolean
    unsubscribe: () => void
    getReason: () => CancelReason
}

export function requestRunCancellation(runId: string, organizationId: string, reason: CancelReason = CancelReason.USER_CANCELLED): void {
    cancellationTaskQueue.emit(new CancellationTask(organizationId, runId, reason))
}

export function requestOrgCancellation(organizationId: string, reason: CancelReason = CancelReason.BILLING_OVERAGE): void {
    cancellationTaskQueue.emit(new CancellationTask(organizationId, undefined, reason))
}

export function listenForRunCancellation(runId: string, organizationId: string, controller: AbortController): RunCancellationSubscription {
    let cancellationRequested = false
    let reason: CancelReason | undefined

    const unsubscribe = cancellationTaskQueue.addListener({
        taskName: CANCELLATION_TASK_NAME,
        onTask: task => {
            if (task.organizationId !== organizationId) {
                return
            }
            if (task.runId !== undefined && task.runId !== runId) {
                return
            }

            cancellationRequested = true
            reason = task.reason
            controller.abort(task.reason)
        }
    })

    return {
        isCancellationRequested: () => cancellationRequested,
        getReason: () => reason ?? CancelReason.USER_CANCELLED,
        unsubscribe
    }
}
