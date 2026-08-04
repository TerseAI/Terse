import { OutputConfigType } from "@prisma/client"
import { MetaAdsOutputConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { MetaAdsIntegrationManager } from "../../integrations/metaAds/integration"
import { PrismaTransaction } from "../../types/prisma"
import { Output } from "../abstract/Output"
import { unrestricted } from "../abstract/acl"

import { metaAdsReadAdsTool } from "./tools/ads"
import { metaAdsReadAudiencesTool, metaAdsUpdateAudienceUsersTool } from "./tools/audiences"
import { metaAdsReadCampaignsTool } from "./tools/campaigns"
import { metaAdsSendConversionsTool } from "./tools/conversions"
import { metaAdsCreateAdTool } from "./tools/createAd"
import { metaAdsReadInsightsTool } from "./tools/insights"
import { metaAdsReadPagesTool } from "./tools/pages"
import { metaAdsListPixelsTool } from "./tools/pixels"
import { metaAdsSetStatusTool } from "./tools/setStatus"

export class MetaAdsOutput extends Output<MetaAdsOutputConfig> {
    constructor() {
        super(OutputConfigType.META_ADS, [
            { tool: metaAdsReadCampaignsTool, isReadOnly: true, integration: IntegrationType.META_ADS, displayName: "Read campaigns", validateACL: unrestricted },
            { tool: metaAdsReadInsightsTool, isReadOnly: true, integration: IntegrationType.META_ADS, displayName: "Read insights", validateACL: unrestricted },
            { tool: metaAdsReadAudiencesTool, isReadOnly: true, integration: IntegrationType.META_ADS, displayName: "Read audiences", validateACL: unrestricted },
            { tool: metaAdsListPixelsTool, isReadOnly: true, integration: IntegrationType.META_ADS, displayName: "List pixels", validateACL: unrestricted },
            { tool: metaAdsReadPagesTool, isReadOnly: true, integration: IntegrationType.META_ADS, displayName: "List Pages", validateACL: unrestricted },
            { tool: metaAdsReadAdsTool, isReadOnly: true, integration: IntegrationType.META_ADS, displayName: "Read ads", validateACL: unrestricted },
            { tool: metaAdsUpdateAudienceUsersTool, isReadOnly: false, integration: IntegrationType.META_ADS, displayName: "Update audience users", validateACL: unrestricted },
            { tool: metaAdsSendConversionsTool, isReadOnly: false, integration: IntegrationType.META_ADS, displayName: "Send conversions", validateACL: unrestricted },
            { tool: metaAdsCreateAdTool, isReadOnly: false, integration: IntegrationType.META_ADS, displayName: "Create ad", validateACL: unrestricted },
            { tool: metaAdsSetStatusTool, isReadOnly: false, integration: IntegrationType.META_ADS, displayName: "Pause or resume", validateACL: unrestricted }
        ])
    }

    async validateConfig(output: MetaAdsOutputConfig, _userId: string): Promise<void> {
        const manager = new MetaAdsIntegrationManager()
        const accessToken = await manager.getAccessToken(output.integrationId)
        if (!accessToken) {
            throw new Error("Failed to get Meta Ads access token. The integration may not be connected.")
        }
    }

    async addOutputToAgent(tx: PrismaTransaction, agentOutputId: string, output: MetaAdsOutputConfig): Promise<void> {
        await tx.automation_meta_ads_configs.create({
            data: {
                automation_output_id: agentOutputId,
                ad_account_id: output.adAccountId,
                page_id: output.pageId
            }
        })
    }

    protected getSystemInstructionsForConfigs(configs: MetaAdsOutputConfig[]): string {
        if (configs.length === 0) {
            throw new Error("No Meta Ads configs provided")
        }

        const sections: string[] = []
        sections.push("=== META ADS SKILL ===")
        sections.push("Available configurations:")
        for (const config of configs) {
            const parts = [`  • Integration ID: ${config.integrationId}`]
            if (config.adAccountId) parts.push(`Default ad account: ${config.adAccountId}`)
            if (config.pageId) parts.push(`Default Page: ${config.pageId}`)
            sections.push(parts.join(" - "))
        }
        sections.push("\nWhen calling Meta Ads tools, include integrationId from a configured entry.")
        sections.push("Use meta_ads_read_campaigns with 'list_ad_accounts' to discover ad account IDs if none is configured, then 'list_campaigns' / 'list_adsets' for structure, status, and budgets.")
        sections.push(
            "Use meta_ads_read_insights for spend, impressions, clicks, and conversions (the 'actions' array) over a datePreset or since/until range. Results are capped at 2000 rows; when truncated=true, narrow the date range or filter by campaign/ad set IDs and fetch again."
        )
        sections.push("Use meta_ads_read_audiences to find custom audience IDs, and meta_ads_update_audience_users to add or remove people; pass raw emails/phones — they are hashed before upload.")
        sections.push("Use meta_ads_list_pixels to find the Conversions API dataset (pixel) ID, then meta_ads_send_conversions to push offline conversions to it.")
        sections.push(
            "For creative work: meta_ads_read_ads lists ads with the creative attached to each, and meta_ads_read_insights with level='ad' attributes spend and results to a specific creative. Judge creatives on ad-level rows, not campaign-level ones."
        )
        sections.push(
            "Ad creatives are immutable and an ad's creative cannot be swapped, so 'improving' a creative means calling meta_ads_create_ad to add a new ad to the same ad set and then meta_ads_set_status to pause the old one. Never expect an edit-in-place path."
        )
        sections.push(
            "meta_ads_create_ad needs a pageId; use the default Page above when one is configured, otherwise call meta_ads_read_pages and ask the user which Page to publish as rather than guessing. New ads land in PENDING_REVIEW, and can come back DISAPPROVED, so re-read effective_status before drawing conclusions."
        )
        sections.push("meta_ads_set_status only pauses and resumes. You cannot change budgets; ask the user to adjust spend themselves.")

        return sections.join("\n")
    }
}
