import { RunHistoryActionType } from "@prisma/client"
import { GoogleSearchConsoleConfigData } from "terse-types"

import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator } from "../../abstract/acl"

import { requireSearchConsoleSiteContext, requireSiteUrlInScope, searchConsoleAction } from "./toolContext"

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

export const validateGoogleSearchConsoleAddSite: ToolACLValidator<"google_search_console_add_site", GoogleSearchConsoleConfigData> = ({ args, configs }) =>
    requireSiteUrlInScope(args.integrationId, args.siteUrl, configs)
