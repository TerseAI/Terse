import { RunHistoryActionType } from "@prisma/client"

import { defineSessionTool } from "../../../tools/toolUtils"

import { applyAudienceUsers } from "./audienceUsers"
import { metaAdsAction, requireMetaAdsClient } from "./toolContext"

export const metaAdsRemoveAudienceUsersTool = defineSessionTool({
    name: "meta_ads_remove_audience_users",
    execute: async ({ integrationId, audienceId, users }, runContext) => {
        const client = await requireMetaAdsClient(integrationId, runContext)
        const result = await applyAudienceUsers(client, { audienceId, users, mode: "remove" })

        return {
            success: true,
            ...result,
            actions: [
                metaAdsAction({
                    action: "Removed audience users",
                    target: audienceId,
                    details: `Removed ${users.length} user(s); Meta received ${result.numReceived}`,
                    type: RunHistoryActionType.delete,
                    isReadOnly: false
                })
            ]
        }
    }
})
