import { RunHistoryActionType } from "@prisma/client"

import { defineSessionTool } from "../../../tools/toolUtils"

import { applyAudienceUsers } from "./audienceUsers"
import { metaAdsAction, requireMetaAdsClient } from "./toolContext"

export const metaAdsAddAudienceUsersTool = defineSessionTool({
    name: "meta_ads_add_audience_users",
    execute: async ({ integrationId, audienceId, users }, runContext) => {
        const client = await requireMetaAdsClient(integrationId, runContext)
        const result = await applyAudienceUsers(client, { audienceId, users, mode: "add" })

        return {
            success: true,
            ...result,
            actions: [
                metaAdsAction({
                    action: "Added audience users",
                    target: audienceId,
                    details: `Added ${users.length} user(s); Meta received ${result.numReceived}`,
                    type: RunHistoryActionType.update,
                    isReadOnly: false
                })
            ]
        }
    }
})
