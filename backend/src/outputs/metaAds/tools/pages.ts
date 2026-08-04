import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, metaAdsPageSchema } from "terse-types"
import type { MetaAdsReadPagesRequest, ToolOutputByName } from "terse-types"

import { defineSessionTool } from "../../../tools/toolUtils"

import { metaAdsToolExecute } from "./metaAdsApi"
import { MetaAdsClient } from "./metaAdsClient"

export const metaAdsReadPagesTool = defineSessionTool({
    name: "meta_ads_read_pages",
    execute: metaAdsToolExecute("meta_ads_read_pages", executeReadPagesRequest)
})

const PAGE_FIELDS = ["id", "name", "category"]

async function executeReadPagesRequest(request: MetaAdsReadPagesRequest, client: MetaAdsClient): Promise<MetaAdsReadPagesOutput> {
    const pages = await client.collect(() => client.me().getAccounts(PAGE_FIELDS, { limit: request.limit ?? 100 }), metaAdsPageSchema, "pages")
    return {
        success: true,
        pages,
        count: pages.length,
        actions: [
            {
                action: "Listed Facebook Pages",
                integration: IntegrationType.META_ADS,
                target: "Meta Ads",
                details: `Found ${pages.length} Page(s)`,
                type: RunHistoryActionType.read
            }
        ]
    }
}

type MetaAdsReadPagesOutput = ToolOutputByName["meta_ads_read_pages"]
