import { RunHistoryActionType } from "@prisma/client"
import { ToolACLValidator, verifyIntegrationIdExists } from "src/outputs/abstract/acl"
import { IntegrationType, SlackOutputConfig } from "terse-types"

import { fetchSlackUsersForIntegration } from "../../../integrations/SlackIntegration"
import logger from "../../../logger"
import { defineSessionTool } from "../../../tools/toolUtils"
import { extractErrorMessage } from "../../../utility/strings"

export const slackListUsersTool = defineSessionTool({
    name: "slack_list_users",
    description: `List Slack workspace users (id and name). Use this to resolve user IDs to names when needed.
Returns non-bot members. Optionally filter by name with the query parameter.`,
    execute: async ({ integrationId, query }, runContext) => {
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

            return {
                success: true,
                users: users.map(u => ({ id: u.id, name: u.name })),
                count: users.length,
                actions: [action]
            }
        } catch (error: unknown) {
            const errorMessage = extractErrorMessage(error)
            logger.error("❌ Error listing Slack users", { error: errorMessage, integrationId })
            throw new Error(`${errorMessage}. Check that the Slack integration is connected and has the required scopes (users:read).`)
        }
    }
})

export const validateSlackListUsers: ToolACLValidator<"slack_list_users", SlackOutputConfig> = ({ args, configs }) => verifyIntegrationIdExists(args.integrationId, configs)
