import { Client } from "@notionhq/client"
import { GetPageResponse, PageObjectResponse } from "@notionhq/client/build/src/api-endpoints"
import { NotionConfig } from "terse-types"

import { getNotionAccessTokenOrThrow } from "../integrations/NotionIntegration"
import { ToolACLValidationResult, denyToolACL } from "../outputs/abstract/Output"

export type NotionScope = { databaseIds: readonly string[]; pageIds: readonly string[] }

const normalizeId = (id: string): string => id.replace(/-/g, "").toLowerCase()

const idMatches = (id: string, allowed: readonly string[]): boolean => {
    const target = normalizeId(id)
    return allowed.some(a => normalizeId(a) === target)
}

const isFullPage = (page: GetPageResponse): page is PageObjectResponse => "parent" in page

export async function isNotionPageInScope(notion: Client, pageId: string, scope: NotionScope, maxDepth = 8): Promise<boolean> {
    if (idMatches(pageId, scope.pageIds)) return true

    let currentId = pageId
    for (let depth = 0; depth < maxDepth; depth++) {
        const page = await notion.pages.retrieve({ page_id: currentId })
        if (!isFullPage(page)) return false

        const parent = page.parent
        switch (parent.type) {
            case "page_id":
                if (idMatches(parent.page_id, scope.pageIds)) return true
                currentId = parent.page_id
                break
            case "database_id":
                return idMatches(parent.database_id, scope.databaseIds)
            case "data_source_id":
                return idMatches(parent.data_source_id, scope.databaseIds)
            case "workspace":
            case "block_id":
            default:
                return false
        }
    }
    return false
}

export async function verifyNotionPageInScope(integrationId: string, pageId: string, config: NotionConfig): Promise<ToolACLValidationResult> {
    const scope: NotionScope = {
        databaseIds: config.databaseIds ?? [],
        pageIds: config.pageIds ?? []
    }
    const accessToken = await getNotionAccessTokenOrThrow(integrationId)
    const notion = new Client({ auth: accessToken })
    const allowed = await isNotionPageInScope(notion, pageId, scope)
    if (allowed) return { ok: true }
    return denyToolACL(`Notion page ${pageId} is not in the allowed scope for integration ${integrationId}. Allowed pages: ${scope.pageIds.join(", ") || "(none)"}; allowed databases: ${scope.databaseIds.join(", ") || "(none)"}.`)
}
