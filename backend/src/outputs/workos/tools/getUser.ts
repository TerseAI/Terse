import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, WorkOSOutputConfig } from "terse-types"

import logger from "../../../logger"
import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator, verifyIntegrationIdExists } from "../../abstract/acl"
import { getWorkOSApiKeyByIntegrationId, getWorkOSUser } from "../workosApiClient"

export const getWorkOSUserTool = defineSessionTool({
    name: "getWorkOSUser",
    description: "Get detailed information about a specific WorkOS user by their user ID. Returns profile data including email, name, verification status, and timestamps.",
    execute: async ({ integrationId, userId }, runContext) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const user = runContext.context.user
        const apiKey = await getWorkOSApiKeyByIntegrationId(integrationId, user)
        if (!apiKey) {
            throw new Error(`WorkOS integration not found or access denied for integrationId: ${integrationId}`)
        }

        try {
            const workosUser = await getWorkOSUser(apiKey, userId)

            const formattedUser = {
                id: workosUser.id,
                email: workosUser.email,
                emailVerified: workosUser.emailVerified,
                firstName: workosUser.firstName,
                lastName: workosUser.lastName,
                profilePictureUrl: workosUser.profilePictureUrl,
                createdAt: workosUser.createdAt,
                updatedAt: workosUser.updatedAt
            }

            const displayName = [workosUser.firstName, workosUser.lastName].filter(Boolean).join(" ") || workosUser.email

            const action = {
                action: "Fetched WorkOS user",
                integration: IntegrationType.WORKOS,
                target: integrationId,
                details: `Retrieved user: ${displayName} (${workosUser.email})`,
                type: RunHistoryActionType.read,
                isReadOnly: true
            }

            return {
                success: true,
                user: formattedUser,
                message: `User: ${displayName} (${workosUser.email})`,
                actions: [action]
            }
        } catch (error: any) {
            logger.error("Error getting WorkOS user", { error, integrationId, userId })
            throw new Error(`Failed to get WorkOS user: ${error.message || "Unknown error"}`)
        }
    }
})

export const validateGetWorkOSUser: ToolACLValidator<"getWorkOSUser", WorkOSOutputConfig> = ({ args, configs }) => verifyIntegrationIdExists(args.integrationId, configs)
