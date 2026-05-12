import { RunHistoryActionType } from "@prisma/client"
import { ToolACLValidator, verifyIntegrationIdExists } from "src/outputs/abstract/acl"
import { IntegrationType, LinearOutputConfig } from "terse-types"

import { getLinearAccessTokenForOrganization } from "../../../integrations/LinearIntegration"
import logger from "../../../logger"
import { LinearAdapter } from "../../../ticketing/linear"
import { defineSessionTool } from "../../../tools/toolUtils"
import { extractErrorMessage } from "../../../utility/strings"

export const linearGetUsersTool = defineSessionTool({
    name: "linear_get_users",
    description: `List users in the Linear workspace. Use to pick assigneeId or subscriberIds when creating or updating issues.`,
    execute: async ({ integrationId }, runContext) => {
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
            const errorMessage = extractErrorMessage(error)
            logger.error("❌ Error listing Linear users", { error: errorMessage, integrationId })
            throw new Error(`${errorMessage}. Check that the access token is valid and has the necessary permissions.`)
        }
    }
})

export const validateLinearGetUsers: ToolACLValidator<"linear_get_users", LinearOutputConfig> = ({ args, configs }) => verifyIntegrationIdExists(args.integrationId, configs)
