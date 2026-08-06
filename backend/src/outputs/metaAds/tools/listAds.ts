import { MetaAdsOutputConfigData, metaAdsAdSchema } from "terse-types"

import { toActPath } from "../../../integrations/metaAds/apiClient"
import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator } from "../../abstract/acl"

import { metaAdsListWindow, metaAdsReadAction, requireAdAccountInScope, requireMetaAdsClient, withEffectiveStatuses, withIdFilters } from "./toolContext"

// Asking for creative{...} inlines the creative on each ad, which is what makes
// ad-level insights attributable to a specific piece of creative.
const AD_FIELDS = ["id", "name", "status", "effective_status", "campaign_id", "adset_id", "created_time", "creative{id,name,title,body,image_url,thumbnail_url,object_story_spec}"]

export const metaAdsListAdsTool = defineSessionTool({
    name: "meta_ads_list_ads",
    execute: async ({ integrationId, adAccountId, adsetId, campaignId, effectiveStatuses, limit }, runContext) => {
        const client = await requireMetaAdsClient(integrationId, runContext)
        const { pageSize, maxItems } = metaAdsListWindow(limit)
        const params = withIdFilters(withEffectiveStatuses({ limit: pageSize }, effectiveStatuses), [
            { field: "adset.id", id: adsetId },
            { field: "campaign.id", id: campaignId }
        ])
        const { items: ads, truncated } = await client.collectPaged(() => client.adAccount(adAccountId).getAds(AD_FIELDS, params), metaAdsAdSchema, "ads", maxItems)

        const scope = adsetId ? `ad set ${adsetId}` : campaignId ? `campaign ${campaignId}` : toActPath(adAccountId)
        return {
            success: true,
            ads,
            count: ads.length,
            truncated,
            actions: [metaAdsReadAction("Listed ads", toActPath(adAccountId), `Found ${ads.length} ad(s) in ${scope}${truncated ? " (truncated)" : ""}`)]
        }
    }
})

export const validateMetaAdsListAds: ToolACLValidator<"meta_ads_list_ads", MetaAdsOutputConfigData> = ({ args, configs }) => requireAdAccountInScope(args.integrationId, args.adAccountId, configs)
