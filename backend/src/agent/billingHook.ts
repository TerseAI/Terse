import type { CallModelInputFilterArgs, ModelInputData } from "@openai/agents-core"
import { CreditGateDeniedError, type RunGateDenyReason } from "terse-types"

import type { Session } from "../express"
import { billingServiceProxyForOrganization } from "../services/BillingService"

import type { InputGuardrailForSession, SessionWithTracking } from "./AgentRunner/BaseAgentRunner"
import { CancelReason, requestOrgCancellation } from "./cancellation/RunCancellationTaskQueue"

export async function billingHook<TSession extends SessionWithTracking<Session>>(args: CallModelInputFilterArgs<TSession>): Promise<ModelInputData> {
    if (!args.context) {
        throw new Error("Context is required")
    }
    const organizationId = args.context.user.organizationId

    const denyReason = await getBillingOverageReason(organizationId, args.context.user.workosId)
    if (denyReason !== null) {
        throw new CreditGateDeniedError(denyReason)
    }
    return args.modelData
}

export const billingInputGuardrail: InputGuardrailForSession<SessionWithTracking<Session>> = {
    name: "Hard block guardrail",
    runInParallel: false,
    execute: async ({ context }) => {
        const organizationId = context.context.user.organizationId
        const denyReason = await getBillingOverageReason(organizationId, context.context.user.workosId)
        return {
            outputInfo: { reason: denyReason ?? "OK" },
            tripwireTriggered: denyReason !== null
        }
    }
}

export async function getBillingOverageReason(organizationId: string, workosUserId: string): Promise<RunGateDenyReason | null> {
    const billing = billingServiceProxyForOrganization(organizationId, workosUserId)
    const gate = await billing.checkRunGate({ organizationId, breakCache: false })
    if (!gate.allow) {
        // Signal to all agents we are stopping.
        requestOrgCancellation(organizationId, CancelReason.BILLING_OVERAGE)
        return gate.reason
    }
    return null
}
