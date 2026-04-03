import { RunContext } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType } from "terse-types"
import { ToolName } from "terse-types"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import logger from "../../../logger"
import { SessionToolOptions } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"
import { getWorkOSApiKeyByIntegrationId, listWorkOSOrganizations } from "../workosApiClient"

const parameters = z.object({
    integrationId: z.string().describe("The integration ID of the WorkOS skill to use."),
    limit: z.number().default(20).describe("Maximum number of organizations to return (default: 20, max: 100)."),
    after: z.string().nullable().optional().describe("Optional pagination cursor. Use the 'after' value from a previous response to get the next page.")
})

export const listWorkOSOrganizationsTool: SessionToolOptions<typeof parameters, typeof ToolName.WORKOS_LIST_ORGANIZATIONS> = {
    name: ToolName.WORKOS_LIST_ORGANIZATIONS,
    description: "List organizations from the customer's WorkOS account. Returns organization names, domains, external IDs, and timestamps. Use pagination (after cursor) for large organization sets.",
    parameters,
    execute: async ({ integrationId, limit = 20, after }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const user = runContext.context.user
        const apiKey = await getWorkOSApiKeyByIntegrationId(integrationId, user)
        if (!apiKey) {
            throw new Error(`WorkOS integration not found or access denied for integrationId: ${integrationId}`)
        }

        const normalizedAfter = after ?? undefined

        try {
            const result = await listWorkOSOrganizations(apiKey, { limit, after: normalizedAfter })

            const organizations = result.data.map(org => ({
                id: org.id,
                name: org.name,
                externalId: org.external_id,
                domains: org.domains ?? [],
                createdAt: org.created_at,
                updatedAt: org.updated_at
            }))

            const action = {
                action: "Listed WorkOS organizations",
                integration: IntegrationType.WORKOS,
                target: integrationId,
                details: `Found ${organizations.length} organization(s)`,
                type: RunHistoryActionType.read,
                isReadOnly: true
            }

            return {
                success: true,
                organizations,
                pagination: {
                    hasMore: !!result.list_metadata.after,
                    after: result.list_metadata.after
                },
                message: `Found ${organizations.length} organization(s)${result.list_metadata.after ? " - more available via pagination" : ""}`,
                actions: [action]
            }
        } catch (error: any) {
            logger.error("Error listing WorkOS organizations", { error, integrationId })
            throw new Error(`Failed to list WorkOS organizations: ${error.message || "Unknown error"}`)
        }
    }
}
