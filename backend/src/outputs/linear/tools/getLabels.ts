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

export const linearGetLabelsTool = tool({
    name: ToolName.LINEAR_GET_LABELS,
    description: `List issue labels for the Linear workspace or a specific team. Use to pick labelIds for linear_create_ticket or linear_update_ticket.`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Linear integration to use."),
        teamId: z.string().nullable().optional().describe("Optional team ID to limit results to that team's labels.")
    }),
    execute: async ({ integrationId, teamId }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("🛠️ Executing linear_get_labels tool", { integrationId, teamId })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }
        const accessToken = await getLinearAccessTokenForOrganization(integrationId, runContext.context.user.organizationId)

        const adapter = new LinearAdapter(accessToken)

        try {
            const labels = await adapter.getLabels(teamId ?? undefined)

            const action = {
                action: "Listed labels",
                integration: IntegrationType.LINEAR,
                target: "Linear workspace",
                details: `Found ${labels.length} label(s)${teamId ? " for team" : ""}`,
                type: RunHistoryActionType.read
            }

            return {
                success: true,
                labels,
                actions: [action]
            }
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext!, error)
            logger.error("❌ Error listing Linear labels", { error: errorMessage, integrationId })
            return {
                success: false,
                error: errorMessage,
                hint: "Check that the access token is valid and has the necessary permissions"
            }
        }
    },
    errorFunction: formatError
})
