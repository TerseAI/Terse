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

export const linearGetUsersTool = tool({
    name: ToolName.LINEAR_GET_USERS,
    description: `List users in the Linear workspace. Use to pick assigneeId or subscriberIds when creating or updating issues.`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Linear integration to use.")
    }),
    execute: async ({ integrationId }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("🛠️ Executing linear_get_users tool", { integrationId })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }
        const accessToken = await getLinearAccessTokenForOrganization(integrationId, runContext.context.user.organizationId)

        const adapter = new LinearAdapter(accessToken)

        try {
            const users = await adapter.getUsers()

            const action = {
                action: "Listed users",
                integration: IntegrationType.LINEAR,
                target: "Linear workspace",
                details: `Found ${users.length} user(s)`,
                type: RunHistoryActionType.read
            }

            return {
                success: true,
                users,
                actions: [action]
            }
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext!, error)
            logger.error("❌ Error listing Linear users", { error: errorMessage, integrationId })
            return {
                success: false,
                error: errorMessage,
                hint: "Check that the access token is valid and has the necessary permissions"
            }
        }
    },
    errorFunction: formatError
})
