export type TerseJobContext = {
    sessionId: string
    runId: string | null
    apiBaseUrl: string
}

// Counts in-process `TerseAgent` runs that have their own `onApprovalRequired`
// callback. The CLI's session-stream consumer reads this to stay quiet when
// the agent's own SSE stream is going to handle the same approval — otherwise
// the user sees two prompts and two POST /sdk/approval-decision calls for one
// stepId. Pinned process-globally so the CLI's and user job's separate
// `terse-sdk` copies share one counter.
const APPROVAL_CLAIM_KEY = Symbol.for("terse.agentApprovalClaim")
type GlobalWithApprovalClaim = typeof globalThis & {
    [APPROVAL_CLAIM_KEY]?: { count: number }
}
const approvalClaimScope = globalThis as GlobalWithApprovalClaim
const approvalClaim: { count: number } = approvalClaimScope[APPROVAL_CLAIM_KEY] ?? (approvalClaimScope[APPROVAL_CLAIM_KEY] = { count: 0 })

export function claimAgentApprovalHandling(): void {
    approvalClaim.count += 1
}

export function releaseAgentApprovalHandling(): void {
    if (approvalClaim.count > 0) approvalClaim.count -= 1
}

export function isAgentApprovalHandlingClaimed(): boolean {
    return approvalClaim.count > 0
}

export type EventTransform = (event: unknown) => unknown

const EVENT_TRANSFORMS_KEY = Symbol.for("terse.eventTransforms")
type GlobalWithEventTransforms = typeof globalThis & {
    [EVENT_TRANSFORMS_KEY]?: Map<string, EventTransform>
}
const eventTransformsScope = globalThis as GlobalWithEventTransforms
const eventTransforms: Map<string, EventTransform> = eventTransformsScope[EVENT_TRANSFORMS_KEY] ?? (eventTransformsScope[EVENT_TRANSFORMS_KEY] = new Map())

export function registerEventTransform(integrationType: string, fn: EventTransform): void {
    eventTransforms.set(integrationType, fn)
}

export function getEventTransform(integrationType: string): EventTransform | undefined {
    return eventTransforms.get(integrationType)
}
