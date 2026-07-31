import { RunHistoryActionType } from "@prisma/client"
import { GoogleSearchConsoleConfigData } from "terse-types"

import { toPermissionLevel } from "../../../integrations/googlesearchconsole/apiClient"
import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator } from "../../abstract/acl"

import { requireSearchConsoleSiteContext, requireSiteUrlInScope, searchConsoleAction } from "./toolContext"

export const googleSearchConsoleGetSiteTool = defineSessionTool({
    name: "google_search_console_get_site",
    execute: async ({ integrationId, siteUrl }, runContext) => {
        const { client, siteUrl: property } = await requireSearchConsoleSiteContext(integrationId, siteUrl, runContext)
        const response = await client.sites.get({ siteUrl: property })

        return {
            success: true,
            site: {
                siteUrl: response.data.siteUrl ?? property,
                permissionLevel: toPermissionLevel(response.data.permissionLevel)
            },
            actions: [
                searchConsoleAction({
                    action: "Retrieved Search Console property",
                    siteUrl: property,
                    details: `Permission level: ${response.data.permissionLevel ?? "unknown"}`,
                    type: RunHistoryActionType.read,
                    isReadOnly: true
                })
            ]
        }
    }
})

export const validateGoogleSearchConsoleGetSite: ToolACLValidator<"google_search_console_get_site", GoogleSearchConsoleConfigData> = ({ args, configs }) =>
    requireSiteUrlInScope(args.integrationId, args.siteUrl, configs)
