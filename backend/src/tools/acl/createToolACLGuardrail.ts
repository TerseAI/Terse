import { defineToolInputGuardrail, RunContext, ToolGuardrailFunctionOutputFactory } from "@openai/agents"
import type { ACLRule } from "terse-types"

import type { Session } from "../../express"
import type { SessionWithTracking } from "../../agent/AgentRunner/BaseAgentRunner"
import type { ToolACLValidator } from "../../outputs/abstract/Output"

/**
 * Generic tool input guardrail for ACL validation. No integration-specific logic.
 *
 * Forwards the SDK-provided `RunContext` to the validator so colocated ACL validators can
 * perform run-scoped backend lookups (e.g. resolving a Slack DM channelId to a userId).
 *
 * Note: `@openai/agents-core` `defineToolInputGuardrail` only accepts `{ name, run }`; there is no
 * per-guardrail `runInParallel` flag for tool input guardrails in SDK 0.8.x (unlike agent input guardrails).
 * Tool input guardrails run in definition order.
 */
export function createToolACLGuardrail<TArgs>(params: {
    toolName: string
    aclRules: ACLRule[]
    validateACL: ToolACLValidator<TArgs>
}) {
    return defineToolInputGuardrail<SessionWithTracking<Session>>({
        name: `acl_${params.toolName}`,
        run: async ({ toolCall, context }) => {
            let args: TArgs

            try {
                const raw = toolCall.arguments
                args = (typeof raw === "string" ? JSON.parse(raw) : raw) as TArgs
            } catch {
                return ToolGuardrailFunctionOutputFactory.rejectContent(`ACL denied for ${params.toolName}: invalid tool arguments JSON.`)
            }

            const result = await params.validateACL({
                args,
                aclRules: params.aclRules,
                runContext: context as RunContext<SessionWithTracking<Session>> | undefined
            })

            if (!result.ok) {
                return ToolGuardrailFunctionOutputFactory.rejectContent(result.message)
            }

            return ToolGuardrailFunctionOutputFactory.allow()
        }
    })
}
