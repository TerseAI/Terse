import { RunHistoryActionType } from "@prisma/client"

import { defineSessionTool } from "../../../tools/toolUtils"

import { requireSearchConsoleSiteContext, searchConsoleAction } from "./toolContext"

export const googleSearchConsoleSubmitSitemapTool = defineSessionTool({
    name: "google_search_console_submit_sitemap",
    execute: async ({ integrationId, siteUrl, feedpath }, runContext) => {
        const { client, siteUrl: property } = await requireSearchConsoleSiteContext(integrationId, siteUrl, runContext)
        await client.sitemaps.submit({ siteUrl: property, feedpath })

        return {
            success: true,
            feedpath,
            actions: [
                searchConsoleAction({
                    action: "Submitted sitemap to Search Console",
                    siteUrl: property,
                    details: `${feedpath} queued for crawling. Processing results appear later via google_search_console_get_sitemap.`,
                    type: RunHistoryActionType.create,
                    isReadOnly: false
                })
            ]
        }
    }
})
