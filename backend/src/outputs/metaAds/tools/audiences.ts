import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, metaAdsCustomAudienceSchema } from "terse-types"
import type { MetaAdsAudienceUser, MetaAdsReadAudiencesRequest, MetaAdsUpdateAudienceUsersRequest, ToolOutputByName } from "terse-types"
import { z } from "zod"

import { defineSessionTool } from "../../../tools/toolUtils"

import { metaAdsToolExecute } from "./metaAdsApi"
import { buildMetaQuery, hashEmail, hashPhone, metaGraphList, metaGraphRequest, toActPath } from "./metaAdsGraph"

export const metaAdsReadAudiencesTool = defineSessionTool({
    name: "meta_ads_read_audiences",
    execute: metaAdsToolExecute("meta_ads_read_audiences", executeReadAudiencesRequest)
})

export const metaAdsUpdateAudienceUsersTool = defineSessionTool({
    name: "meta_ads_update_audience_users",
    execute: metaAdsToolExecute("meta_ads_update_audience_users", executeUpdateAudienceUsersRequest)
})

async function executeReadAudiencesRequest(request: MetaAdsReadAudiencesRequest, accessToken: string): Promise<MetaAdsReadAudiencesOutput> {
    const query = buildMetaQuery({
        fields: "id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound,delivery_status",
        limit: request.limit ?? 100
    })
    const audiences = await metaGraphList(accessToken, `/${toActPath(request.adAccountId)}/customaudiences${query}`, metaAdsCustomAudienceSchema, "custom audiences")
    return {
        success: true,
        audiences,
        count: audiences.length,
        actions: [
            {
                action: "Listed custom audiences",
                integration: IntegrationType.META_ADS,
                target: toActPath(request.adAccountId),
                details: `Found ${audiences.length} custom audience(s)`,
                type: RunHistoryActionType.read
            }
        ]
    }
}

const audienceUsersResponseSchema = z.object({
    audience_id: z.string().optional(),
    num_received: z.number(),
    num_invalid_entries: z.number().optional()
})

async function executeUpdateAudienceUsersRequest(request: MetaAdsUpdateAudienceUsersRequest, accessToken: string): Promise<MetaAdsUpdateAudienceUsersOutput> {
    const payload = buildHashedUsersPayload(request.users)
    const response = await metaGraphRequest(accessToken, `/${encodeURIComponent(request.audienceId)}/users`, audienceUsersResponseSchema, "audience users update", {
        method: request.action === "add" ? "POST" : "DELETE",
        body: { payload }
    })

    const verb = request.action === "add" ? "Added" : "Removed"
    return {
        success: true,
        audienceId: request.audienceId,
        numReceived: response.num_received,
        numInvalidEntries: response.num_invalid_entries ?? 0,
        actions: [
            {
                action: `${verb} audience users`,
                integration: IntegrationType.META_ADS,
                target: request.audienceId,
                details: `${verb} ${request.users.length} user(s); Meta received ${response.num_received}`,
                type: request.action === "add" ? RunHistoryActionType.update : RunHistoryActionType.delete
            }
        ]
    }
}

// Multi-key schema upload: missing keys are sent as empty strings, per the Marketing API contract.
function buildHashedUsersPayload(users: readonly MetaAdsAudienceUser[]): { schema: string[]; data: string[][] } {
    const invalid = users.filter(user => !user.email && !user.phone && !user.externalId)
    if (invalid.length > 0) {
        throw new Error(`${invalid.length} user(s) have no email, phone, or externalId; each user needs at least one match key.`)
    }

    return {
        schema: ["EMAIL", "PHONE", "EXTERN_ID"],
        data: users.map(user => [user.email ? hashEmail(user.email) : "", user.phone ? hashPhone(user.phone) : "", user.externalId ?? ""])
    }
}

type MetaAdsReadAudiencesOutput = ToolOutputByName["meta_ads_read_audiences"]
type MetaAdsUpdateAudienceUsersOutput = ToolOutputByName["meta_ads_update_audience_users"]
