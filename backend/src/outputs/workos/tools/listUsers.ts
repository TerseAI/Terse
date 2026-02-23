import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import logger from "../../../logger"
import { IntegrationType } from "../../../shared/Integrations"
import { ToolName } from "../../../tools/ToolNames"
import { Session } from "../../../types/session"
import { getWorkOSApiKeyByIntegrationId, listWorkOSUsers } from "../workosApiClient"

export const listWorkOSUsersTool = tool({
    name: ToolName.WORKOS_LIST_USERS,
    description:
        "List users from the customer's WorkOS account. Supports filtering by email and organization ID. Returns user profiles including email, name, and creation date. Use pagination (after cursor) for large user sets.",
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the WorkOS knowledge base to use."),
        email: z.union([z.string(), z.null()]).describe("Filter by exact email address. Pass null to list all users."),
        organizationId: z.union([z.string(), z.null()]).describe("Filter users by WorkOS organization ID. Pass null for all organizations."),
        limit: z.number().default(20).describe("Maximum number of users to return (default: 20, max: 100)."),
        after: z.union([z.string(), z.null()]).describe("Pagination cursor. Use the 'after' value from a previous response to get the next page. Pass null for the first page.")
    }),
    execute: async ({ integrationId, email, organizationId, limit = 20, after }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const user = runContext.context.user
        const apiKey = await getWorkOSApiKeyByIntegrationId(integrationId, user)
        if (!apiKey) {
            throw new Error(`WorkOS integration not found or access denied for integrationId: ${integrationId}`)
        }

        const normalizedEmail = email ?? undefined
        const normalizedOrgId = organizationId ?? undefined
        const normalizedAfter = after ?? undefined

        try {
            const result = await listWorkOSUsers(apiKey, { limit, after: normalizedAfter, email: normalizedEmail, organizationId: normalizedOrgId })

            const users = result.data.map(u => ({
                id: u.id,
                email: u.email,
                emailVerified: u.email_verified,
                firstName: u.first_name,
                lastName: u.last_name,
                profilePictureUrl: u.profile_picture_url,
                createdAt: u.created_at,
                updatedAt: u.updated_at
            }))

            const filterDesc = [normalizedEmail && `email="${normalizedEmail}"`, normalizedOrgId && `org="${normalizedOrgId}"`].filter(Boolean).join(", ")

            const action = {
                action: "Listed WorkOS users",
                integration: IntegrationType.WORKOS,
                target: integrationId,
                details: `Found ${users.length} user(s)${filterDesc ? ` filtered by ${filterDesc}` : ""}`,
                type: RunHistoryActionType.read,
                isReadOnly: true
            }

            return {
                success: true,
                users,
                pagination: {
                    hasMore: !!result.list_metadata.after,
                    after: result.list_metadata.after
                },
                message: `Found ${users.length} user(s)${filterDesc ? ` (${filterDesc})` : ""}${result.list_metadata.after ? " - more available via pagination" : ""}`,
                actions: [action]
            }
        } catch (error: any) {
            logger.error("Error listing WorkOS users", { error, integrationId })
            throw new Error(`Failed to list WorkOS users: ${error.message || "Unknown error"}`)
        }
    }
})
