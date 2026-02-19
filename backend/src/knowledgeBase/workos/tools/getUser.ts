import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import logger from "../../../logger"
import { IntegrationType } from "../../../shared/Integrations"
import { ToolName } from "../../../tools/ToolNames"
import { Session } from "../../../types/session"
import { getWorkOSApiKeyByIntegrationId, getWorkOSUser } from "../workosKbApiClient"

export const getWorkOSUserTool = tool({
    name: ToolName.WORKOS_GET_USER,
    description: "Get detailed information about a specific WorkOS user by their user ID. Returns profile data including email, name, verification status, and timestamps.",
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the WorkOS knowledge base to use."),
        userId: z.string().describe("The WorkOS user ID to look up.")
    }),
    execute: async ({ integrationId, userId }, runContext?: RunContext<SessionWithTracking<Session>>) => {
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
                emailVerified: workosUser.email_verified,
                firstName: workosUser.first_name,
                lastName: workosUser.last_name,
                profilePictureUrl: workosUser.profile_picture_url,
                createdAt: workosUser.created_at,
                updatedAt: workosUser.updated_at
            }

            const displayName = [workosUser.first_name, workosUser.last_name].filter(Boolean).join(" ") || workosUser.email

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
