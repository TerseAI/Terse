import { defineToolInputGuardrail, ToolGuardrailFunctionOutputFactory } from "@openai/agents"

import { ACL_WILDCARD, ACLCheckResult, ACLItem, ACLProvider } from "../../shared/acl"

// MARK: Guardrail

export function createACLGuardrail<TContext = unknown>(checker: (toolName: string, args: Record<string, unknown>) => Promise<ACLCheckResult>) {
    return defineToolInputGuardrail<TContext>({
        name: "acl_guardrail",
        run: async data => {
            let args: Record<string, unknown>
            try {
                args = JSON.parse(data.toolCall.arguments || "{}")
            } catch {
                return ToolGuardrailFunctionOutputFactory.rejectContent("Invalid tool arguments: could not parse JSON.")
            }

            const result = await checker(data.toolCall.name, args)
            if (result.allowed) {
                return ToolGuardrailFunctionOutputFactory.allow()
            }

            return ToolGuardrailFunctionOutputFactory.rejectContent(result.reason)
        }
    })
}

// MARK: ACL helpers

export function isPermitted(requested: ACLItem, allowed: ACLItem[]): boolean {
    return allowed.some(
        item =>
            item.integration === requested.integration &&
            item.resourceType === requested.resourceType &&
            (item.resourceId === ACL_WILDCARD || item.resourceId === requested.resourceId)
    )
}

/** Returns the ACL for an integration, or null if the integration is not configured for this agent. */
export function getACLOrNull<T extends ACLProvider>(configs: T[], integrationId: string): ACLItem[] | null {
    const matching = configs.filter(c => c.integrationId === integrationId)
    if (matching.length === 0) return null
    return matching.flatMap(c => c.getACL())
}
