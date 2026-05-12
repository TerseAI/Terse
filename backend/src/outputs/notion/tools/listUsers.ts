import { Client } from "@notionhq/client"
import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, NotionConfig } from "terse-types"

import { getNotionAccessTokenForOrganization } from "../../../integrations/NotionIntegration"
import logger from "../../../logger"
import { defineSessionTool } from "../../../tools/toolUtils"
import { extractErrorMessage } from "../../../utility/strings"
import { ToolACLValidator, verifyIntegrationIdExists } from "../../abstract/Output"

export const notionListUsersTool = defineSessionTool({
    name: "notion_list_users",
    description: `List users in the Notion workspace. Use this to resolve user names to Notion user IDs
for populating People properties (e.g., Assignee, Owner) when creating or updating database pages.

Returns workspace members (not bots). Optionally filter by name with the query parameter.

Use the returned user IDs in people property format:
{"Assignee": {"people": [{"object": "user", "id": "<user_id>"}]}}`,
    execute: async ({ integrationId, query }, runContext) => {
        logger.debug("Executing notion_list_users tool", { integrationId, query })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        try {
            const accessToken = await getNotionAccessTokenForOrganization(integrationId, runContext.context.user.organizationId)

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
            const errorMessage = extractErrorMessage(error)
            logger.error("Error listing Notion users", { error: errorMessage, integrationId })
            throw new Error(`${errorMessage}. Check that the Notion integration is connected and has access to the workspace.`)
        }
    }
})

export const validateNotionListUsers: ToolACLValidator<"notion_list_users", NotionConfig> = ({ args, configs }) => verifyIntegrationIdExists(args.integrationId, configs)
