import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, LinearOutputConfig } from "terse-types"

import { getLinearAccessTokenForOrganization } from "../../../integrations/LinearIntegration"
import logger from "../../../logger"
import { LinearAdapter } from "../../../ticketing/linear"
import { defineSessionTool } from "../../../tools/toolUtils"
import { extractErrorMessage } from "../../../utility/strings"
import { ToolACLValidator } from "../../abstract/acl"

export const linearGetTeamsTool = defineSessionTool({
    name: "linear_get_teams",
    description: `List teams in the Linear workspace. Use to pick teamId when creating tickets or when calling linear_get_states, linear_get_labels, or linear_get_projects for a specific team.`,
    execute: async ({ integrationId }, runContext) => {
        logger.debug("🛠️ Executing linear_get_teams tool", { integrationId })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }
        const accessToken = await getLinearAccessTokenForOrganization(integrationId, runContext.context.user.organizationId)

        const adapter = new LinearAdapter(accessToken)

        try {
            const teams = await adapter.getTeams()

            const action = {
                action: "Listed teams",
                integration: IntegrationType.LINEAR,
                target: "Linear workspace",
                details: `Found ${teams.length} team(s)`,
                type: RunHistoryActionType.read
            }

            return {
                success: true,
                teams,
                actions: [action]
            }
        } catch (error: unknown) {
            const errorMessage = extractErrorMessage(error)
            logger.error("❌ Error listing Linear teams", { error: errorMessage, integrationId })
            throw new Error(`${errorMessage}. Check that the access token is valid and has the necessary permissions.`)
        }
    }
})
