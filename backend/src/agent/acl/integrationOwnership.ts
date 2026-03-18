import { ToolGuardrailFunctionOutputFactory, defineToolInputGuardrail } from "@openai/agents"

export function createSelectedIntegrationGuardrail<TContext = unknown>(validatedIds: Set<string>) {
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
                `Integration ${integrationId} is not configured for this agent. ` + `The agent only has access to integrations that were configured by its owner.`
            )
        }
    })
}
