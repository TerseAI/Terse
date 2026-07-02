import { RedisTaskQueue } from "../../../tasks/abstract/redisTaskQueue"
import { Task } from "../../../tasks/abstract/tasks"

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
        public organizationId: string,
        public decision: ApprovalDecision
    ) {}
}

const approvalTaskQueue = new RedisTaskQueue<ApprovalDecisionTask>("approval")

export function waitForApprovalDecision(runId: string, stepId: string, organizationId: string): Promise<ApprovalDecision> {
    return approvalTaskQueue.waitFor(APPROVAL_DECISION_TASK_NAME, task => task.runId === runId && task.stepId === stepId && task.organizationId === organizationId).then(task => task.decision)
}

/** Rejects with SignalPublishError if the decision could not be delivered — the run would stay blocked. */
export function resolveApprovalDecision(runId: string, stepId: string, organizationId: string, decision: ApprovalDecision): Promise<void> {
    return approvalTaskQueue.emit(new ApprovalDecisionTask(runId, stepId, organizationId, decision))
}
