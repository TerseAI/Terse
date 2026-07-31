import { RunHistoryActionType } from "@prisma/client"

import { listSearchConsoleSites } from "../../../integrations/googlesearchconsole/apiClient"
import { defineSessionTool } from "../../../tools/toolUtils"

import { requireSearchConsoleClient, searchConsoleAction } from "./toolContext"

export const googleSearchConsoleListSitesTool = defineSessionTool({
    name: "google_search_console_list_sites",
    execute: async ({ integrationId }, runContext) => {
        const client = await requireSearchConsoleClient(integrationId, runContext)
        const sites = await listSearchConsoleSites(client)

        return {
            success: true,
            sites,
            actions: [
                searchConsoleAction({
                    action: "Listed Search Console properties",
                    siteUrl: "Search Console account",
                    details: `Found ${sites.length} ${sites.length === 1 ? "property" : "properties"}`,
                    type: RunHistoryActionType.read,
                    isReadOnly: true
                })
            ]
        }
    }
})
