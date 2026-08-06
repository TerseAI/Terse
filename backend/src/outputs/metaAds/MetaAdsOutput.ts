import { OutputConfigType } from "@prisma/client"
import { IntegrationType, MetaAdsOutputConfigData } from "terse-types"

import { MetaAdsIntegrationManager } from "../../integrations/metaAds/integration"
import { PrismaTransaction } from "../../types/prisma"
import { Output } from "../abstract/Output"
import { unrestricted } from "../abstract/acl"

import {
    metaAdsAddAudienceUsersTool,
    metaAdsCreateAdTool,
    metaAdsListAdAccountsTool,
    metaAdsListAdSetsTool,
    metaAdsListAdsTool,
    metaAdsListAudiencesTool,
    metaAdsListCampaignsTool,
    metaAdsListPagesTool,
    metaAdsListPixelsTool,
    metaAdsReadInsightsTool,
    metaAdsRemoveAudienceUsersTool,
    metaAdsSendConversionsTool,
    metaAdsSetStatusTool,
    validateMetaAdsCreateAd,
    validateMetaAdsListAdSets,
    validateMetaAdsListAds,
    validateMetaAdsListAudiences,
    validateMetaAdsListCampaigns,
    validateMetaAdsListPixels,
    validateMetaAdsReadInsights
} from "./tools"

export class MetaAdsOutput extends Output<MetaAdsOutputConfigData> {
    constructor() {
        super(OutputConfigType.META_ADS, [
            { tool: metaAdsListAdAccountsTool, isReadOnly: true, integration: IntegrationType.META_ADS, displayName: "List ad accounts", validateACL: unrestricted },
            { tool: metaAdsListCampaignsTool, isReadOnly: true, integration: IntegrationType.META_ADS, displayName: "List campaigns", validateACL: validateMetaAdsListCampaigns },
            { tool: metaAdsListAdSetsTool, isReadOnly: true, integration: IntegrationType.META_ADS, displayName: "List ad sets", validateACL: validateMetaAdsListAdSets },
            { tool: metaAdsListAdsTool, isReadOnly: true, integration: IntegrationType.META_ADS, displayName: "List ads", validateACL: validateMetaAdsListAds },
            { tool: metaAdsListAudiencesTool, isReadOnly: true, integration: IntegrationType.META_ADS, displayName: "List audiences", validateACL: validateMetaAdsListAudiences },
            { tool: metaAdsListPixelsTool, isReadOnly: true, integration: IntegrationType.META_ADS, displayName: "List pixels", validateACL: validateMetaAdsListPixels },
            { tool: metaAdsListPagesTool, isReadOnly: true, integration: IntegrationType.META_ADS, displayName: "List Pages", validateACL: unrestricted },
            { tool: metaAdsReadInsightsTool, isReadOnly: true, integration: IntegrationType.META_ADS, displayName: "Read insights", validateACL: validateMetaAdsReadInsights },
            { tool: metaAdsAddAudienceUsersTool, isReadOnly: false, integration: IntegrationType.META_ADS, displayName: "Add audience users", validateACL: unrestricted },
            { tool: metaAdsRemoveAudienceUsersTool, isReadOnly: false, integration: IntegrationType.META_ADS, displayName: "Remove audience users", validateACL: unrestricted },
            { tool: metaAdsSendConversionsTool, isReadOnly: false, integration: IntegrationType.META_ADS, displayName: "Send conversions", validateACL: unrestricted },
            { tool: metaAdsCreateAdTool, isReadOnly: false, integration: IntegrationType.META_ADS, displayName: "Create ad", validateACL: validateMetaAdsCreateAd },
            { tool: metaAdsSetStatusTool, isReadOnly: false, integration: IntegrationType.META_ADS, displayName: "Set status", validateACL: unrestricted }
        ])
    }

    async validateConfig(output: MetaAdsOutputConfigData, _userId: string): Promise<void> {
        const manager = new MetaAdsIntegrationManager()
        const accessToken = await manager.getAccessToken(output.integrationId)
        if (!accessToken) {
            throw new Error("Failed to get Meta Ads access token. The integration may not be connected.")
        }
    }

    async addOutputToAgent(tx: PrismaTransaction, agentOutputId: string, output: MetaAdsOutputConfigData): Promise<void> {
        await tx.automation_meta_ads_configs.create({
            data: {
                automation_output_id: agentOutputId,
                ad_account_id: output.adAccountId,
                page_id: output.pageId
            }
        })
    }

    protected getSystemInstructionsForConfigs(configs: MetaAdsOutputConfigData[]): string {
        if (configs.length === 0) {
            throw new Error("No Meta Ads configs provided")
        }

        const sections: string[] = ["=== META ADS SKILL ===", "Available configurations:"]
        for (const config of configs) {
            const parts = [`  • Integration ID: ${config.integrationId}`]
            if (config.adAccountId) parts.push(`Allowed ad account: ${config.adAccountId}`)
            if (config.pageId) parts.push(`Allowed Page: ${config.pageId}`)
            sections.push(parts.join(" - "))
        }

        sections.push("\nWhen calling Meta Ads tools, include integrationId from a configured entry.")
        sections.push(
            "Pass adAccountId explicitly on every tool that takes one. When an allowed ad account is listed above, only that account is permitted; otherwise discover one with meta_ads_list_ad_accounts."
        )
        sections.push(
            "Structure reads are one tool per object: meta_ads_list_campaigns, meta_ads_list_adsets (pass campaignId to narrow), and meta_ads_list_ads. Each returns its own collection plus truncated."
        )
        sections.push(
            "Use meta_ads_read_insights for spend, impressions, clicks, and conversions (the 'actions' array) over a datePreset or since/until range. Results are capped at 2000 rows; when truncated=true, narrow the date range or filter by campaign/ad set IDs and fetch again."
        )
        sections.push(
            "Use meta_ads_list_audiences to find custom audience IDs, then meta_ads_add_audience_users or meta_ads_remove_audience_users; pass raw emails/phones, they are hashed before upload."
        )
        sections.push("Use meta_ads_list_pixels to find the Conversions API dataset (pixel) ID, then meta_ads_send_conversions to push offline conversions to it.")
        sections.push(
            "For creative work: meta_ads_list_ads lists ads with the creative attached to each, and meta_ads_read_insights with level='ad' attributes spend and results to a specific creative. Judge creatives on ad-level rows, not campaign-level ones."
        )
        sections.push(
            "Ad creatives are immutable and an ad's creative cannot be swapped, so 'improving' a creative means calling meta_ads_create_ad to add a new ad to the same ad set and then meta_ads_set_status to pause the old one. Never expect an edit-in-place path."
        )
        sections.push(
            "meta_ads_create_ad requires a pageId. Use the allowed Page above when one is listed, otherwise call meta_ads_list_pages and ask the user which Page to publish as rather than guessing. New ads land in PENDING_REVIEW, and can come back DISAPPROVED, so re-read effective_status before drawing conclusions."
        )
        sections.push(
            "meta_ads_create_ad takes a creative object discriminated by format: 'single_image' (imageUrl + message), 'single_video' (videoUrl, optional thumbnailUrl), 'carousel' (2-10 cards, each card media:'image' with imageUrl or media:'video' with videoUrl, plus its own headline), or one of 'dynamic_image' / 'dynamic_video' / 'dynamic_mixed' (messages[] and headlines[] plus the matching media array). Only set the fields belonging to the format you chose."
        )
        sections.push(
            "Use a dynamic_* format only when the ad set already has dynamic creative enabled, otherwise Meta rejects the ad; when unsure, create separate single-format ads instead and compare them on ad-level insights. Dynamic creative is capped at 30 assets in total across media and text. Videos are uploaded and encoded before the ad is created, so a video ad takes noticeably longer than an image ad."
        )
        sections.push("meta_ads_set_status only pauses and resumes. You cannot change budgets; ask the user to adjust spend themselves.")

        return sections.join("\n")
    }
}
