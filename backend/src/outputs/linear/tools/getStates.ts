import { RunHistoryActionType } from "@prisma/client"
import { ToolACLValidator, denyToolACL, findConfigsByIntegrationId, verifyIntegrationIdExists } from "src/outputs/abstract/acl"
import { IntegrationType, LinearOutputConfig } from "terse-types"

import { getLinearAccessTokenForOrganization } from "../../../integrations/LinearIntegration"
import logger from "../../../logger"
import { LinearAdapter } from "../../../ticketing/linear"
import { defineSessionTool } from "../../../tools/toolUtils"
import { extractErrorMessage } from "../../../utility/strings"

export const linearGetStatesTool = defineSessionTool({
    name: "linear_get_states",
    description: `List workflow states for the Linear workspace or a specific team. Use when creating or updating issues to pick a valid stateId (e.g. "Todo", "In Progress", "Done").`,
    execute: async ({ integrationId, teamId }, runContext) => {
        logger.debug("🛠️ Executing linear_get_states tool", { integrationId, teamId })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }
        const accessToken = await getLinearAccessTokenForOrganization(integrationId, runContext.context.user.organizationId)

        const adapter = new LinearAdapter(accessToken)

        try {
            const states = await adapter.getStates(teamId ?? undefined)

            const action = {
                action: "Listed workflow states",
                integration: IntegrationType.LINEAR,
                target: "Linear workspace",
                details: `Found ${states.length} state(s)${teamId ? " for team" : ""}`,
                type: RunHistoryActionType.read
            }

            return {
                success: true,
                states,
                actions: [action]
            }
        } catch (error: unknown) {
            const errorMessage = extractErrorMessage(error)
            logger.error("❌ Error listing Linear states", { error: errorMessage, integrationId })
            throw new Error(`${errorMessage}. Check that the access token is valid and has the necessary permissions.`)
        }
    }
})

export const validateLinearGetStates: ToolACLValidator<"linear_get_states", LinearOutputConfig> = ({ args, configs }) => validateLinearOptionalTeam(args.integrationId, args.teamId, configs)

export const validateLinearOptionalTeam = (integrationId: string, teamId: string | null | undefined, configs: LinearOutputConfig[]) => {
    const idCheck = verifyIntegrationIdExists(integrationId, configs)
    if (!idCheck.ok) return idCheck
    if (!teamId) return { ok: true as const }
    const matching = findConfigsByIntegrationId(integrationId, configs)
    const narrowing = matching.filter(c => c.teamId)
    if (narrowing.length === 0) return { ok: true as const }
    if (narrowing.some(c => c.teamId === teamId)) return { ok: true as const }
    const allowed = narrowing.map(c => c.teamId).join(", ") || "(none)"
    return denyToolACL(`Linear teamId "${teamId}" is not in the configured teams for integration "${integrationId}": ${allowed}.`)
}
