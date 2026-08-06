import { RunHistoryActionType } from "@prisma/client"

import { defineSessionTool } from "../../../tools/toolUtils"

import { toSitemap } from "./sitemapMapper"
import { requireSearchConsoleSiteContext, searchConsoleAction } from "./toolContext"

export const googleSearchConsoleGetSitemapTool = defineSessionTool({
    name: "google_search_console_get_sitemap",
    execute: async ({ integrationId, siteUrl, feedpath }, runContext) => {
        const { client, siteUrl: property } = await requireSearchConsoleSiteContext(integrationId, siteUrl, runContext)
        const response = await client.sitemaps.get({ siteUrl: property, feedpath })
        const sitemap = toSitemap(response.data)

        return {
            success: true,
            sitemap,
            actions: [
                searchConsoleAction({
                    action: "Retrieved Search Console sitemap",
                    siteUrl: property,
                    details: `${feedpath}: ${sitemap.isPending ? "pending processing" : "processed"}, ${sitemap.errors ?? 0} errors, ${sitemap.warnings ?? 0} warnings`,
                    type: RunHistoryActionType.read,
                    isReadOnly: true
                })
            ]
        }
    }
})
