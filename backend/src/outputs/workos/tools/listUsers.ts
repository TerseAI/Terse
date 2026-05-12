import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, WorkOSOutputConfig } from "terse-types"

import logger from "../../../logger"
import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator, verifyIntegrationIdExists } from "../../abstract/Output"
import { getWorkOSApiKeyByIntegrationId, listWorkOSUsers } from "../workosApiClient"

export const listWorkOSUsersTool = defineSessionTool({
    name: "listWorkOSUsers",
    description:
        "List users from the customer's WorkOS account. Supports filtering by email and organization ID. Returns user profiles including email, name, and creation date. Use pagination (after cursor) for large user sets.",
    execute: async ({ integrationId, email, organizationId, limit = 20, after }, runContext) => {
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
                emailVerified: u.emailVerified,
                firstName: u.firstName,
                lastName: u.lastName,
                profilePictureUrl: u.profilePictureUrl,
                createdAt: u.createdAt,
                updatedAt: u.updatedAt
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
                    hasMore: !!result.listMetadata.after,
                    after: result.listMetadata.after
                },
                message: `Found ${users.length} user(s)${filterDesc ? ` (${filterDesc})` : ""}${result.listMetadata.after ? " - more available via pagination" : ""}`,
                actions: [action]
            }
        } catch (error: any) {
            logger.error("Error listing WorkOS users", { error, integrationId })
            throw new Error(`Failed to list WorkOS users: ${error.message || "Unknown error"}`)
        }
    }
})

export const validateListWorkOSUsers: ToolACLValidator<"listWorkOSUsers", WorkOSOutputConfig> = ({ args, configs }) => verifyIntegrationIdExists(args.integrationId, configs)
