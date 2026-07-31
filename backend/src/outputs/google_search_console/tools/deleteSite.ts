import { RunHistoryActionType } from "@prisma/client"
import { GoogleSearchConsoleConfigData } from "terse-types"

import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator } from "../../abstract/acl"

import { requireSearchConsoleSiteContext, requireSiteUrlInScope, searchConsoleAction } from "./toolContext"

export const googleSearchConsoleDeleteSiteTool = defineSessionTool({
    name: "google_search_console_delete_site",
    execute: async ({ integrationId, siteUrl }, runContext) => {
        const { client, siteUrl: property } = await requireSearchConsoleSiteContext(integrationId, siteUrl, runContext)
        await client.sites.delete({ siteUrl: property })

        return {
            success: true,
            siteUrl: property,
            actions: [
                searchConsoleAction({
                    action: "Removed Search Console property",
                    siteUrl: property,
                    details: "Property unlinked from the connected Google account",
                    type: RunHistoryActionType.delete,
                    isReadOnly: false
                })
            ]
        }
    }
})

export const validateGoogleSearchConsoleDeleteSite: ToolACLValidator<"google_search_console_delete_site", GoogleSearchConsoleConfigData> = ({ args, configs }) =>
    requireSiteUrlInScope(args.integrationId, args.siteUrl, configs)
