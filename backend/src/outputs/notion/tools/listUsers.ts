import { Client } from "@notionhq/client"
import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, NotionConfig } from "terse-types"

import logger from "../../../common/logger"
import { extractErrorMessage } from "../../../common/strings"
import { getNotionAccessTokenForOrganization } from "../../../integrations/notion/integration"
import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator } from "../../abstract/acl"

export const notionListUsersTool = defineSessionTool({
    name: "notion_list_users",
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
