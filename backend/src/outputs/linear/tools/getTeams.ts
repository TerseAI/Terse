import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, LinearOutputConfig } from "terse-types"

import logger from "../../../common/logger"
import { extractErrorMessage } from "../../../common/strings"
import { getLinearAccessTokenForOrganization } from "../../../integrations/linear/integration"
import { LinearAdapter } from "../../../integrations/linear/ticketing"
import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator } from "../../abstract/acl"

export const linearGetTeamsTool = defineSessionTool({
    name: "linear_get_teams",
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
