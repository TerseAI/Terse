import { AsyncLocalStorage } from "node:async_hooks"

export type TerseJobContext = {
    sessionId: string
    runId: string | null
    apiBaseUrl: string
}

// AsyncLocalStorage tracks context per *instance*. If multiple copies of this
// module get loaded in the same process (e.g. the CLI's `terse-sdk` + the
// user's `terse-sdk` loaded by `tsx`'s isolated loader), each copy would
// otherwise create its own instance and the context would not propagate.
// Pin the instance to a process-global symbol so every copy shares one store.
const STORE_KEY = Symbol.for("terse.jobContextStore")
type GlobalWithStore = typeof globalThis & {
    [STORE_KEY]?: AsyncLocalStorage<TerseJobContext>
}
const globalScope = globalThis as GlobalWithStore
const store: AsyncLocalStorage<TerseJobContext> = globalScope[STORE_KEY] ?? (globalScope[STORE_KEY] = new AsyncLocalStorage<TerseJobContext>())

export async function runWithJobContext<T>(ctx: TerseJobContext, fn: () => Promise<T>): Promise<T> {
    return store.run(ctx, fn)
}

export function getJobContext(): TerseJobContext | undefined {
    return store.getStore()
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
