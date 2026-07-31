import { RunHistoryActionType } from "@prisma/client"
import { GoogleSearchConsoleConfigData } from "terse-types"

import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator } from "../../abstract/acl"

import { toSitemap } from "./sitemapMapper"
import { requireSearchConsoleSiteContext, requireSiteUrlInScope, searchConsoleAction } from "./toolContext"

export const googleSearchConsoleListSitemapsTool = defineSessionTool({
    name: "google_search_console_list_sitemaps",
    execute: async ({ integrationId, siteUrl, sitemapIndex }, runContext) => {
        const { client, siteUrl: property } = await requireSearchConsoleSiteContext(integrationId, siteUrl, runContext)
        const response = await client.sitemaps.list({ siteUrl: property, ...(sitemapIndex ? { sitemapIndex } : {}) })
        const sitemaps = (response.data.sitemap ?? []).map(toSitemap)

        return {
            success: true,
            sitemaps,
            actions: [
                searchConsoleAction({
                    action: "Listed Search Console sitemaps",
                    siteUrl: property,
                    details: `Found ${sitemaps.length} ${sitemaps.length === 1 ? "sitemap" : "sitemaps"}${sitemapIndex ? ` in index ${sitemapIndex}` : ""}`,
                    type: RunHistoryActionType.read,
                    isReadOnly: true
                })
            ]
        }
    }
})

export const validateGoogleSearchConsoleListSitemaps: ToolACLValidator<"google_search_console_list_sitemaps", GoogleSearchConsoleConfigData> = ({ args, configs }) =>
    requireSiteUrlInScope(args.integrationId, args.siteUrl, configs)
