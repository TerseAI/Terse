import { RunHistoryActionType } from "@prisma/client"

import { defineSessionTool } from "../../../tools/toolUtils"

import { requireSearchConsoleSiteContext, searchConsoleAction } from "./toolContext"

export const googleSearchConsoleAddSiteTool = defineSessionTool({
    name: "google_search_console_add_site",
    execute: async ({ integrationId, siteUrl }, runContext) => {
        const { client, siteUrl: property } = await requireSearchConsoleSiteContext(integrationId, siteUrl, runContext)
        await client.sites.add({ siteUrl: property })

        return {
            success: true,
            siteUrl: property,
            actions: [
                searchConsoleAction({
                    action: "Added Search Console property",
                    siteUrl: property,
                    details: "Property added to the connected Google account. It stays unverified until ownership is verified in Search Console.",
                    type: RunHistoryActionType.create,
                    isReadOnly: false
                })
            ]
        }
    }
})
