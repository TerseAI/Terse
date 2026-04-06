import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType } from "terse-types"

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
