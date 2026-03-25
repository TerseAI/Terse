/**
 * In-process gate for SDK agent runs that are awaiting approval.
 *
 * When the SSE handler hits `awaiting_approval`, it registers a pending gate
 * and awaits its resolution. The POST /sdk/approval-decision endpoint resolves
 * the gate, allowing the handler to resume the agent on the same SSE stream.
 */

export type ApprovalDecision = {
    approved: boolean
}

type PendingGate = {
    resolve: (decision: ApprovalDecision) => void
}

const pendingGates = new Map<string, PendingGate>()

function gateKey(runId: string, stepId: string): string {
    return `${runId}:${stepId}`
}

export function waitForApprovalDecision(runId: string, stepId: string): Promise<ApprovalDecision> {
    const key = gateKey(runId, stepId)
    return new Promise<ApprovalDecision>(resolve => {
        pendingGates.set(key, { resolve })
    })
}

export function resolveApprovalDecision(runId: string, stepId: string, decision: ApprovalDecision): boolean {
    const key = gateKey(runId, stepId)
    const gate = pendingGates.get(key)
    if (!gate) return false
    pendingGates.delete(key)
    gate.resolve(decision)
    return true
}
