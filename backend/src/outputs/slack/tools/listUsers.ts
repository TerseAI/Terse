import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, SlackOutputConfig } from "terse-types"

import logger from "../../../common/logger"
import { extractErrorMessage } from "../../../common/strings"
import { fetchSlackUsersForIntegration } from "../../../integrations/slack/integration"
import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator } from "../../abstract/acl"

export const slackListUsersTool = defineSessionTool({
    name: "slack_list_users",
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
                users = users.filter(u => u.name?.toLowerCase().includes(normalizedQuery) || u.email?.toLowerCase().includes(normalizedQuery))
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
                users: users.map(u => ({ id: u.id, name: u.name, email: u.email })),
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
