import { RunHistoryActionType } from "@prisma/client"
import { GoogleSearchConsoleConfigData } from "terse-types"

import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator } from "../../abstract/acl"

import { requireSearchConsoleSiteContext, requireSiteUrlInScope, searchConsoleAction } from "./toolContext"

export const googleSearchConsoleDeleteSitemapTool = defineSessionTool({
    name: "google_search_console_delete_sitemap",
    execute: async ({ integrationId, siteUrl, feedpath }, runContext) => {
        const { client, siteUrl: property } = await requireSearchConsoleSiteContext(integrationId, siteUrl, runContext)
        await client.sitemaps.delete({ siteUrl: property, feedpath })

        return {
            success: true,
            feedpath,
            actions: [
                searchConsoleAction({
                    action: "Removed sitemap from Search Console",
                    siteUrl: property,
                    details: `${feedpath} is no longer tracked. Already-indexed URLs remain in the index.`,
                    type: RunHistoryActionType.delete,
                    isReadOnly: false
                })
            ]
        }
    }
})

export const validateGoogleSearchConsoleDeleteSitemap: ToolACLValidator<"google_search_console_delete_sitemap", GoogleSearchConsoleConfigData> = ({ args, configs }) =>
    requireSiteUrlInScope(args.integrationId, args.siteUrl, configs)
