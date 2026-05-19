import { EventEmitterTaskQueue } from "../tasks/abstract/eventEmitterTasks"
import { Task } from "../tasks/abstract/tasks"

const APPROVAL_DECISION_TASK_NAME = "SDK_APPROVAL_DECISION" as const

export type ApprovalDecision = {
    approved: boolean
    rejectionReason?: string
    /** When true, the SSE handler must finalize the run as cancelled instead of resuming the agent. */
    hardReject?: boolean
}

class ApprovalDecisionTask implements Task {
    readonly taskName = APPROVAL_DECISION_TASK_NAME

    constructor(
        public runId: string,
        public stepId: string,
        public decision: ApprovalDecision
    ) {}
}

const approvalTaskQueue = new EventEmitterTaskQueue<ApprovalDecisionTask>()

export function waitForApprovalDecision(runId: string, stepId: string): Promise<ApprovalDecision> {
    return approvalTaskQueue.waitFor(APPROVAL_DECISION_TASK_NAME, task => task.runId === runId && task.stepId === stepId).then(task => task.decision)
}

export function resolveApprovalDecision(runId: string, stepId: string, decision: ApprovalDecision): void {
    approvalTaskQueue.emit(new ApprovalDecisionTask(runId, stepId, decision))
}
