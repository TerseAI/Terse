import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { getLinearAccessTokenForOrganization } from "../../../integrations/LinearIntegration"
import logger from "../../../logger"
import { IntegrationType } from "../../../shared/Integrations"
import { LinearAdapter } from "../../../ticketing/linear"
import { ToolName } from "../../../tools/ToolNames"
import { formatError } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"

export const linearGetTeamsTool = tool({
    name: ToolName.LINEAR_GET_TEAMS,
    description: `List teams in the Linear workspace. Use to pick teamId when creating tickets or when calling linear_get_states, linear_get_labels, or linear_get_projects for a specific team.`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Linear integration to use.")
    }),
    execute: async ({ integrationId }, runContext?: RunContext<SessionWithTracking<Session>>) => {
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
            const errorMessage = error instanceof Error ? error.message : String(error)
            logger.error("❌ Error listing Linear teams", { error: errorMessage, integrationId })
            throw new Error(`${errorMessage}. Check that the access token is valid and has the necessary permissions.`)
        }
    },
    errorFunction: formatError
})
