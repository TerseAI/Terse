import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { LinearIntegrationManager } from "../../../integrations/LinearIntegration"
import logger from "../../../logger"
import { IntegrationType } from "../../../shared/Integrations"
import { LinearAdapter } from "../../../ticketing/linear"
import { ToolName } from "../../../tools/ToolNames"
import { formatError } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"

export const linearGetStatesTool = tool({
    name: ToolName.LINEAR_GET_STATES,
    description: `List workflow states for the Linear workspace or a specific team. Use when creating or updating issues to pick a valid stateId (e.g. "Todo", "In Progress", "Done").`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Linear integration to use."),
        teamId: z.string().nullable().optional().describe("Optional team ID to limit results to that team's states.")
    }),
    execute: async ({ integrationId, teamId }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("🛠️ Executing linear_get_states tool", { integrationId, teamId })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const organizationId = runContext.context.user.organizationId
        const linearIntegration = await db().linear_integrations.findUnique({
            where: { id: integrationId, organization_id: organizationId }
        })
        if (!linearIntegration) {
            throw new Error(`Linear integration not found for integrationId: ${integrationId}`)
        }

        const manager = new LinearIntegrationManager()
        const accessToken = await manager.getAccessToken(linearIntegration.id)
        if (!accessToken) {
            throw new Error(`Linear integration not found or access denied for integrationId: ${integrationId}`)
        }

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
            const errorMessage = await formatError(runContext!, error)
            logger.error("❌ Error listing Linear states", { error: errorMessage, integrationId })
            return {
                success: false,
                error: errorMessage,
                hint: "Check that the access token is valid and has the necessary permissions"
            }
        }
    },
    errorFunction: formatError
})
