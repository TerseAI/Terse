import { RunContext } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType } from "terse-types"
import { ToolName } from "terse-types"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { getLinearAccessTokenForOrganization } from "../../../integrations/LinearIntegration"
import logger from "../../../logger"
import { LinearAdapter } from "../../../ticketing/linear"
import { SessionToolOptions } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"
import { extractErrorMessage } from "../../../utility/strings"

const parameters = z.object({
    integrationId: z.string().describe("The integration ID of the Linear integration to use."),
    teamId: z.string().nullable().optional().describe("Optional team ID to limit results to that team's projects.")
})

export const linearGetProjectsTool: SessionToolOptions<typeof parameters, typeof ToolName.LINEAR_GET_PROJECTS> = {
    name: ToolName.LINEAR_GET_PROJECTS,
    description: `List projects for the Linear workspace or a specific team. Use to pick projectId when creating or updating issues.`,
    parameters: parameters,
    execute: async ({ integrationId, teamId }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("🛠️ Executing linear_get_projects tool", { integrationId, teamId })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }
        const accessToken = await getLinearAccessTokenForOrganization(integrationId, runContext.context.user.organizationId)

        const adapter = new LinearAdapter(accessToken)

        try {
            const projects = await adapter.getProjects(teamId ?? undefined)

            const action = {
                action: "Listed projects",
                integration: IntegrationType.LINEAR,
                target: "Linear workspace",
                details: `Found ${projects.length} project(s)${teamId ? " for team" : ""}`,
                type: RunHistoryActionType.read
            }

            return {
                success: true,
                projects,
                actions: [action]
            }
        } catch (error: unknown) {
            const errorMessage = extractErrorMessage(error)
            logger.error("❌ Error listing Linear projects", { error: errorMessage, integrationId })
            throw new Error(`${errorMessage}. Check that the access token is valid and has the necessary permissions.`)
        }
    }
}
