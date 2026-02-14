import { Client } from "@notionhq/client"
import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { NotionIntegrationManager } from "../../../integrations/NotionIntegration"
import logger from "../../../logger"
import { db } from "../../../prismaClient"
import { IntegrationType } from "../../../shared/Integrations"
import { ToolName } from "../../../tools/ToolNames"
import { formatError } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"

export const notionListUsersTool = tool({
    name: ToolName.NOTION_LIST_USERS,
    description: `List users in the Notion workspace. Use this to resolve user names to Notion user IDs
for populating People properties (e.g., Assignee, Owner) when creating or updating database pages.

Returns workspace members (not bots). Optionally filter by name with the query parameter.

Use the returned user IDs in people property format:
{"Assignee": {"people": [{"object": "user", "id": "<user_id>"}]}}`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Notion workspace to use."),
        query: z.string().nullable().optional().describe("Optional search query to filter users by name. Case-insensitive partial match.")
    }),
    execute: async ({ integrationId, query }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("Executing notion_list_users tool", { integrationId, query })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        try {
            const organizationId = runContext.context.user.organizationId
            const notionIntegration = await db().notion_integrations.findUnique({
                where: { id: integrationId, organization_id: organizationId }
            })
            if (!notionIntegration) {
                throw new Error(`Notion integration not found for integrationId: ${integrationId}`)
            }

            const manager = new NotionIntegrationManager()
            const accessToken = await manager.getAccessToken(notionIntegration.id)
            if (!accessToken) {
                throw new Error(`Notion integration not found or access denied for integrationId: ${integrationId}`)
            }

            const notion = new Client({ auth: accessToken })

            const allUsers: { id: string; name: string; email?: string }[] = []
            let cursor: string | undefined

            do {
                const response = await notion.users.list({
                    page_size: 100,
                    start_cursor: cursor
                })

                for (const u of response.results as any[]) {
                    if (u.type !== "person") continue
                    const name = u.name ?? undefined
                    const email = u.person?.email ?? undefined
                    allUsers.push({ id: u.id, name: name ?? "", email })
                }

                cursor = response.has_more ? ((response.next_cursor as string) ?? undefined) : undefined
            } while (cursor)

            let users = allUsers
            if (query?.trim()) {
                const normalizedQuery = query.trim().toLowerCase()
                users = allUsers.filter(u => u.name?.toLowerCase().includes(normalizedQuery) || u.email?.toLowerCase().includes(normalizedQuery))
            }

            const action = {
                action: "Listed workspace users",
                integration: IntegrationType.NOTION,
                target: "Notion workspace",
                details: `Found ${users.length} user(s)`,
                type: RunHistoryActionType.read
            }

            return {
                success: true,
                users: users.map(u => ({ id: u.id, name: u.name, ...(u.email ? { email: u.email } : {}) })),
                count: users.length,
                actions: [action]
            }
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext!, error)
            logger.error("Error listing Notion users", { error: errorMessage, integrationId })
            return {
                success: false,
                error: errorMessage,
                hint: "Check that the Notion integration is connected and has access to the workspace."
            }
        }
    },
    errorFunction: formatError
})
