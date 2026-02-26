import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { fetchSlackUsersForIntegration } from "../../../integrations/SlackIntegration"
import logger from "../../../logger"
import { IntegrationType } from "../../../shared/Integrations"
import type { ToolOutputByName } from "../../../shared/types"
import { ToolName } from "../../../tools/ToolNames"
import { toolOutput } from "../../../tools/toolOutput"
import { formatError } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"

export const slackListUsersTool = tool<z.ZodObject<any>, SessionWithTracking<Session>, ToolOutputByName["slack_list_users"]>({
    name: ToolName.SLACK_LIST_USERS,
    description: `List Slack workspace users (id and name). Use this to resolve user IDs to names when needed.
Returns non-bot members. Optionally filter by name with the query parameter.`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Slack workspace (user_slack_integrations id)."),
        query: z.string().nullable().optional().describe("Optional search query to filter users by name. Case-insensitive partial match.")
    }),
    execute: async ({ integrationId, query }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("🛠️ Executing slack_list_users tool", { integrationId, query })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const userId = runContext.context.user?.id
        const organizationId = runContext.context.user?.organizationId
        if (!userId || !organizationId) {
            throw new Error("User and organization context required")
        }

        try {
            const response = await fetchSlackUsersForIntegration(userId, organizationId, integrationId)
            let users = response.users

            if (query?.trim()) {
                const normalizedQuery = query.trim().toLowerCase()
                users = users.filter(u => u.name?.toLowerCase().includes(normalizedQuery))
            }

            const action = {
                action: "Listed Slack users",
                integration: IntegrationType.SLACK,
                target: "Slack workspace",
                details: `Found ${users.length} user(s)`,
                type: RunHistoryActionType.read
            }

            return toolOutput("slack_list_users", {
                success: true,
                users: users.map(u => ({ id: u.id, name: u.name })),
                count: users.length,
                actions: [action]
            })
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            logger.error("❌ Error listing Slack users", { error: errorMessage, integrationId })
            throw new Error(`${errorMessage}. Check that the Slack integration is connected and has the required scopes (users:read).`)
        }
    },
    errorFunction: formatError
})
