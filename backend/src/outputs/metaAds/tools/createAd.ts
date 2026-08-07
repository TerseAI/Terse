import { RunHistoryActionType } from "@prisma/client"
import { MetaAdsCarouselCard } from "terse-types"
import type { ToolInputByName } from "terse-types"

import { MetaAdsClient, toActPath, uploadMetaAdsImageHash, uploadMetaAdsVideo } from "../../../integrations/metaAds/apiClient"
import { defineSessionTool } from "../../../tools/toolUtils"

import { metaAdsAction, requireMetaAdsClient } from "./toolContext"

// Creative content is immutable in Meta, and an ad's creative cannot be swapped,
// so every creative revision is a fresh creative plus a fresh ad.
export const metaAdsCreateAdTool = defineSessionTool({
    name: "meta_ads_create_ad",
    execute: async (input, runContext) => {
        const client = await requireMetaAdsClient(input.integrationId, runContext)
        const adAccount = client.adAccount(input.adAccountId)
        const requestedStatus = input.status ?? "PAUSED"

        const media = await uploadCreativeMedia(client, input)
        const creativeId = await client.createdId(() => adAccount.createAdCreative(["id"], buildCreativeParams(input, media)), "ad creative")
        const adId = await client.createdId(
            () =>
                adAccount.createAd(["id"], {
                    name: input.name,
                    adset_id: input.adsetId,
                    creative: { creative_id: creativeId },
                    status: requestedStatus
                }),
            "ad"
        )

        return {
            success: true,
            adId,
            creativeId,
            adsetId: input.adsetId,
            pageId: input.pageId,
            format: input.creative.format,
            requestedStatus,
            videoIds: media.videoIds,
            imageHashes: media.imageHashes,
            actions: [
                metaAdsAction({
                    action: "Created ad",
                    target: toActPath(input.adAccountId),
                    details: `Created ${input.creative.format} ad "${input.name}" (${adId}) in ad set ${input.adsetId} with status ${requestedStatus}; Meta reviews new ads before delivery`,
                    type: RunHistoryActionType.create,
                    isReadOnly: false
                })
            ]
        }
    }
})

/**
 * Videos always need an upload to become a video_id, and dynamic creative needs
 * image hashes rather than URLs. Every other format lets Meta fetch the image URL
 * itself, so nothing travels through us.
 */
async function uploadCreativeMedia(client: MetaAdsClient, input: MetaAdsCreateAdInput): Promise<UploadedMedia> {
    const adAccountId = input.adAccountId
    const creative = input.creative

    switch (creative.format) {
        case "single_image":
            return { videoIds: [], imageHashes: [] }
        case "single_video":
            return { videoIds: [await uploadMetaAdsVideo(client, adAccountId, creative.videoUrl)], imageHashes: [] }
        case "carousel": {
            assertCarouselCardBudget(creative.cards.length, !!creative.optimizeCardOrder)
            const cardVideoIds = await Promise.all(creative.cards.map(card => (card.media === "video" ? uploadMetaAdsVideo(client, adAccountId, card.videoUrl) : Promise.resolve(null))))
            return { videoIds: cardVideoIds.filter((id): id is string => !!id), imageHashes: [], cardVideoIds }
        }
        case "dynamic_image":
            assertDynamicAssetBudget(creative, creative.imageUrls.length)
            return { videoIds: [], imageHashes: await uploadImageHashes(client, adAccountId, creative.imageUrls) }
        case "dynamic_video":
            assertDynamicAssetBudget(creative, creative.videoUrls.length)
            return { videoIds: await uploadVideos(client, adAccountId, creative.videoUrls), imageHashes: [] }
        case "dynamic_mixed": {
            assertDynamicAssetBudget(creative, creative.imageUrls.length + creative.videoUrls.length)
            const [imageHashes, videoIds] = await Promise.all([uploadImageHashes(client, adAccountId, creative.imageUrls), uploadVideos(client, adAccountId, creative.videoUrls)])
            return { videoIds, imageHashes }
        }
        default:
            throw creative satisfies never
    }
}

function buildCreativeParams(input: MetaAdsCreateAdInput, media: UploadedMedia): Record<string, unknown> {
    return {
        name: `${input.name} creative`,
        ...buildFormatParams(input, media),
        ...(input.urlTags ? { url_tags: input.urlTags } : {})
    }
}

function buildFormatParams(input: MetaAdsCreateAdInput, media: UploadedMedia): Record<string, unknown> {
    const creative = input.creative
    switch (creative.format) {
        case "single_image":
            return {
                object_story_spec: {
                    ...pageActors(input),
                    link_data: {
                        link: input.linkUrl,
                        message: creative.message,
                        // Meta downloads this once and copies it into the ad account's
                        // image library, so a short-lived signed URL is enough.
                        picture: creative.imageUrl,
                        ...(creative.headline ? { name: creative.headline } : {}),
                        ...(creative.description ? { description: creative.description } : {}),
                        ...callToAction(input)
                    }
                }
            }
        case "single_video":
            return {
                object_story_spec: {
                    ...pageActors(input),
                    video_data: {
                        video_id: media.videoIds[0],
                        message: creative.message,
                        ...(creative.thumbnailUrl ? { image_url: creative.thumbnailUrl } : {}),
                        ...(creative.headline ? { title: creative.headline } : {}),
                        ...(creative.description ? { link_description: creative.description } : {}),
                        ...videoCallToAction(input)
                    }
                }
            }
        case "carousel":
            return {
                object_story_spec: {
                    ...pageActors(input),
                    link_data: {
                        link: input.linkUrl,
                        message: creative.message,
                        child_attachments: creative.cards.map((card, index) => buildChildAttachment(card, index, input, media)),
                        ...(creative.optimizeCardOrder ? { multi_share_optimized: true } : {}),
                        ...(creative.showEndCard === null || creative.showEndCard === undefined ? {} : { multi_share_end_card: creative.showEndCard }),
                        ...callToAction(input)
                    }
                }
            }
        case "dynamic_image":
            return buildAssetFeedParams(input, creative, media, "SINGLE_IMAGE")
        case "dynamic_video":
            return buildAssetFeedParams(input, creative, media, "SINGLE_VIDEO")
        case "dynamic_mixed":
            return buildAssetFeedParams(input, creative, media, "AUTOMATIC_FORMAT")
        default:
            throw creative satisfies never
    }
}

// Meta allows more than 5 cards only when it is free to reorder them.
function assertCarouselCardBudget(cardCount: number, optimizeCardOrder: boolean): void {
    const maxCards = optimizeCardOrder ? MAX_OPTIMIZED_CAROUSEL_CARDS : MAX_CAROUSEL_CARDS
    if (cardCount < MIN_CAROUSEL_CARDS || cardCount > maxCards) {
        throw new Error(
            `A carousel needs between ${MIN_CAROUSEL_CARDS} and ${maxCards} cards; got ${cardCount}.${optimizeCardOrder ? "" : ` Set optimizeCardOrder to allow up to ${MAX_OPTIMIZED_CAROUSEL_CARDS}.`}`
        )
    }
}

/**
 * Meta caps an asset feed at 30 assets in total, counting the ad_format and the
 * single link_url alongside the media and text variants.
 */
function assertDynamicAssetBudget(creative: MetaAdsDynamicCreative, mediaCount: number): void {
    const total = mediaCount + creative.messages.length + creative.headlines.length + (creative.descriptions?.length ?? 0) + creative.callToActions.length + LINK_URL_AND_FORMAT_ASSETS
    if (total > MAX_ASSET_FEED_ASSETS) {
        throw new Error(`Dynamic creative allows ${MAX_ASSET_FEED_ASSETS} assets in total; this ad supplies ${total}. Drop some media or text variants.`)
    }
}

// AdCreative has no top-level page_id, so the Page actor rides in object_story_spec
// even for dynamic creative, alongside rather than instead of asset_feed_spec.
function buildAssetFeedParams(input: MetaAdsCreateAdInput, creative: MetaAdsDynamicCreative, media: UploadedMedia, adFormat: string): Record<string, unknown> {
    return {
        object_story_spec: pageActors(input),
        asset_feed_spec: {
            ...(media.imageHashes.length ? { images: media.imageHashes.map(hash => ({ hash })) } : {}),
            ...(media.videoIds.length ? { videos: media.videoIds.map(video_id => ({ video_id })) } : {}),
            bodies: creative.messages.map(text => ({ text })),
            titles: creative.headlines.map(text => ({ text })),
            ...(creative.descriptions?.length ? { descriptions: creative.descriptions.map(text => ({ text })) } : {}),
            link_urls: [{ website_url: input.linkUrl }],
            call_to_action_types: creative.callToActions,
            ad_formats: [adFormat]
        }
    }
}

function uploadImageHashes(client: MetaAdsClient, adAccountId: string, imageUrls: readonly string[]): Promise<string[]> {
    return Promise.all(imageUrls.map(url => uploadMetaAdsImageHash(client, adAccountId, url)))
}

function uploadVideos(client: MetaAdsClient, adAccountId: string, videoUrls: readonly string[]): Promise<string[]> {
    return Promise.all(videoUrls.map(url => uploadMetaAdsVideo(client, adAccountId, url)))
}

// `link` is required on every child attachment, so a card without its own falls
// back to the ad's destination rather than being sent incomplete.
function buildChildAttachment(card: MetaAdsCarouselCard, index: number, input: MetaAdsCreateAdInput, media: UploadedMedia): Record<string, unknown> {
    return {
        link: card.linkUrl || input.linkUrl,
        name: card.headline,
        ...(card.description ? { description: card.description } : {}),
        ...(card.media === "video" ? { video_id: media.cardVideoIds?.[index] } : { picture: card.imageUrl })
    }
}

function pageActors(input: MetaAdsCreateAdInput): Record<string, unknown> {
    return {
        page_id: input.pageId,
        ...(input.instagramUserId ? { instagram_user_id: input.instagramUserId } : {})
    }
}

// Meta treats call_to_action as optional and renders its own default button when it
// is absent, so an unset callToAction sends no key rather than a guess.
function callToAction(input: MetaAdsCreateAdInput): Record<string, unknown> {
    if (!input.callToAction) {
        return {}
    }
    return { call_to_action: { type: input.callToAction, value: { link: input.linkUrl } } }
}

// video_data has no `link` of its own, so the call_to_action is the only carrier for
// the destination. NO_BUTTON keeps Meta's chrome unchanged while still routing clicks.
function videoCallToAction(input: MetaAdsCreateAdInput): Record<string, unknown> {
    return { call_to_action: { type: input.callToAction ?? "NO_BUTTON", value: { link: input.linkUrl } } }
}

const MIN_CAROUSEL_CARDS = 2
const MAX_CAROUSEL_CARDS = 5
const MAX_OPTIMIZED_CAROUSEL_CARDS = 10
const MAX_ASSET_FEED_ASSETS = 30
// The ad_format and the single link_url each count against the asset budget.
const LINK_URL_AND_FORMAT_ASSETS = 2

type MetaAdsCreateAdInput = ToolInputByName["meta_ads_create_ad"]
type MetaAdsDynamicCreative = Extract<MetaAdsCreateAdInput["creative"], { format: `dynamic_${string}` }>

interface UploadedMedia {
    readonly videoIds: string[]
    readonly imageHashes: string[]
    // Positional per carousel card, so a card's video survives alongside image cards.
    readonly cardVideoIds?: Array<string | null>
}
