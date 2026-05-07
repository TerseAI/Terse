import type { CallModelInputFilterArgs, ModelInputData } from "@openai/agents-core"

import type { Session } from "../express"
import { billingServiceProxyForOrganization } from "../services/BillingService"

import type { InputGuardrailForSession, SessionWithTracking } from "./AgentRunner/BaseAgentRunner"
import { CancelReason, requestOrgCancellation } from "./cancellation/RunCancellationTaskQueue"

export async function billingHook<TSession extends SessionWithTracking<Session>>(args: CallModelInputFilterArgs<TSession>): Promise<ModelInputData> {
    if (!args.context) {
        throw new Error("Context is required")
    }
    const organizationId = args.context.user.organizationId

    const shouldBlock = await isBillingOver(organizationId)
    if (shouldBlock) {
        throw new Error("Billing overage")
    }
    return args.modelData
}

export const billingInputGuardrail: InputGuardrailForSession<SessionWithTracking<Session>> = {
    name: "Hard block guardrail",
    runInParallel: false,
    execute: async ({ context }) => {
        const organizationId = context.context.user.organizationId
        const shouldBlock = await isBillingOver(organizationId)
        return {
            outputInfo: { reason: shouldBlock ? "Billing overage" : "OK" },
            tripwireTriggered: shouldBlock
        }
    }
}

export async function isBillingOver(organizationId: string): Promise<boolean> {
    const billing = billingServiceProxyForOrganization(organizationId)
    const gate = await billing.checkRunGate({ organizationId, breakCache: false })
    if (!gate.allow) {
        // Signal to all agents we are stopping.
        requestOrgCancellation(organizationId, CancelReason.BILLING_OVERAGE)
        return true
    }
    return false
}
