import { defineToolInputGuardrail, ToolGuardrailFunctionOutputFactory } from "@openai/agents"

import { ACLItem, ACL_WILDCARD, ConfigInstance } from "../../shared/Configs"
import { ACLCheckResult } from "../../outputs/abstract/Output"

export function createACLGuardrail<TContext = unknown>(checker: (toolName: string, args: Record<string, unknown>) => Promise<ACLCheckResult>) {
    return defineToolInputGuardrail<TContext>({
        name: "acl_guardrail",
        run: async data => {
            let args: Record<string, unknown>
            try {
                args = JSON.parse(data.toolCall.arguments || "{}")
            } catch {
                return ToolGuardrailFunctionOutputFactory.allow()
            }

            const result = await checker(data.toolCall.name, args)
            if (result.allowed) {
                return ToolGuardrailFunctionOutputFactory.allow()
            }

            return ToolGuardrailFunctionOutputFactory.rejectContent(result.reason)
        }
    })
}

export function isPermitted(requested: ACLItem, allowed: ACLItem[]): boolean {
    return allowed.some(item => {
        return (
            item.integration === requested.integration &&
            item.resourceType === requested.resourceType &&
            (item.resourceId === ACL_WILDCARD || item.resourceId === requested.resourceId)
        )
    })
}

export function getConfigsForIntegration<TConfig extends ConfigInstance>(configs: TConfig[], integrationId: string | undefined): TConfig[] {
    if (!integrationId) {
        return []
    }

    return configs.filter(config => config.integrationId === integrationId)
}

export function getACLForIntegration<TConfig extends ConfigInstance>(configs: TConfig[], integrationId: string | undefined): ACLItem[] {
    return getConfigsForIntegration(configs, integrationId).flatMap(config => config.getACL())
}
