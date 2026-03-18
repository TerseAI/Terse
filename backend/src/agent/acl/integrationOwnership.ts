import { ToolGuardrailFunctionOutputFactory, defineToolInputGuardrail } from "@openai/agents"

import { ConfigInstance } from "../../shared/Configs"

/**
 * Builds a Set of all integrationIds from the given configs.
 * These are already validated as belonging to the org at agent creation time.
 */
export function collectConfiguredIntegrationIds(configs: ConfigInstance[]): Set<string> {
    return new Set(configs.map(c => c.integrationId))
}

/**
 * Guardrail that rejects tool calls whose `integrationId` argument
 * is not one of the agent's configured integrations.
 *
 * This centralises the "integration belongs to this org" check so
 * individual tools no longer need to query with organization_id.
 */
export function createIntegrationOwnershipGuardrail<TContext = unknown>(validatedIds: Set<string>) {
    return defineToolInputGuardrail<TContext>({
        name: "integration_ownership_guardrail",
        run: async data => {
            let args: Record<string, unknown>
            try {
                args = JSON.parse(data.toolCall.arguments || "{}")
            } catch {
                // Let the ACL guardrail or the tool itself handle parse errors
                return ToolGuardrailFunctionOutputFactory.allow()
            }

            const integrationId = typeof args.integrationId === "string" ? args.integrationId : null
            if (!integrationId) {
                // Tool doesn't use integrationId — nothing to enforce
                return ToolGuardrailFunctionOutputFactory.allow()
            }

            if (validatedIds.has(integrationId)) {
                return ToolGuardrailFunctionOutputFactory.allow()
            }

            return ToolGuardrailFunctionOutputFactory.rejectContent(
                `Integration ${integrationId} is not configured for this agent. ` +
                    `The agent only has access to integrations that were configured by its owner.`
            )
        }
    })
}
