import crypto from "crypto"
import { Ad, AdAccount, AdSet, AdVideo, AdsPixel, Business, Campaign, CustomAudience, FacebookAdsApi, User } from "facebook-nodejs-business-sdk"
import { metaAdsAdAccountEntitySchema, metaAdsPageSchema } from "terse-types"
import type { MetaAdsAdAccountEntity, MetaAdsPage as MetaAdsPageEntity } from "terse-types"
import { z } from "zod"

export class MetaAdsClient {
    private readonly api: FacebookAdsApi

    constructor(accessToken: string) {
        this.api = new FacebookAdsApi(accessToken)
    }

    adAccount(adAccountId: string): AdAccount {
        return new AdAccount(toActPath(adAccountId), {}, null, this.api)
    }

    me(): User {
        return new User("me", {}, null, this.api)
    }

    business(businessId: string): Business {
        return new Business(businessId, {}, null, this.api)
    }

    campaign(campaignId: string): Campaign {
        return new Campaign(campaignId, {}, null, this.api)
    }

    adSet(adSetId: string): AdSet {
        return new AdSet(adSetId, {}, null, this.api)
    }

    ad(adId: string): Ad {
        return new Ad(adId, {}, null, this.api)
    }

    customAudience(audienceId: string): CustomAudience {
        return new CustomAudience(audienceId, {}, null, this.api)
    }

    adsPixel(datasetId: string): AdsPixel {
        return new AdsPixel(datasetId, {}, null, this.api)
    }

    adVideo(videoId: string): AdVideo {
        return new AdVideo(videoId, {}, null, this.api)
    }

    // Reads one page of an edge. Meta caps `limit` per edge, so callers wanting
    // everything should use collectPaged instead.
    async collect<T>(fetchEdge: EdgeFetch, itemSchema: z.ZodType<T>, what: string): Promise<T[]> {
        const cursor = await this.runEdge(fetchEdge, what)
        return cursor.map(node => parseNode(node, itemSchema, what))
    }

    // Follows the cursor until Meta stops handing back pages or we hit maxItems,
    // whichever comes first. `truncated` tells the agent to narrow its query.
    async collectPaged<T>(fetchEdge: EdgeFetch, itemSchema: z.ZodType<T>, what: string, maxItems: number): Promise<MetaAdsPagedResult<T>> {
        const items: T[] = []
        let cursor = await this.runEdge(fetchEdge, what)

        for (;;) {
            const pageSize = cursor.length
            items.push(...cursor.map(node => parseNode(node, itemSchema, what)))
            if (items.length >= maxItems) {
                return { items: items.slice(0, maxItems), truncated: true }
            }
            // Meta can hand back a next link that yields nothing, so an empty page
            // ends pagination rather than being followed forever.
            if (pageSize === 0 || !cursor.hasNext()) {
                return { items, truncated: false }
            }
            cursor = await this.runEdge(() => cursor.next(), what)
        }
    }

    /**
     * The SDK hands back an AbstractCrudObject whose fields sit behind defined
     * properties, and which of them are populated depends on what Meta echoed, so
     * the id is read from the exported payload as well as the property. The payload
     * goes into the error because a bare "no id" tells you nothing about the cause.
     */
    async createdId(create: () => Promise<unknown>, what: string): Promise<string> {
        const created = await runGraph(create, what)
        const exported = toPlainNode(created)
        const parsed = createdNodeSchema.safeParse(exported)
        const id = parsed.success ? (parsed.data.id ?? parsed.data.post_id ?? parsed.data.creative_id) : undefined

        if (!id) {
            throw new MetaAdsPayloadError(what, `Meta did not return an id for the created object. It responded with: ${JSON.stringify(exported)}`)
        }
        return id
    }

    async mutate(update: () => Promise<unknown>, what: string): Promise<void> {
        await runGraph(update, what)
    }

    // For single-node calls whose response body carries data we care about.
    async runParsed<T>(call: () => Promise<unknown>, schema: z.ZodType<T>, what: string): Promise<T> {
        const result = await runGraph(call, what)
        return parseNode(result, schema, what)
    }

    private async runEdge(fetchEdge: EdgeFetch, what: string): Promise<MetaCursor> {
        const cursor = await runGraph(async () => fetchEdge(), what)
        if (!isMetaCursor(cursor)) {
            throw new MetaAdsPayloadError(what, "Meta returned a page without cursor semantics.")
        }
        return cursor
    }
}

async function runGraph<T>(call: () => Promise<T>, what: string): Promise<T> {
    try {
        return await call()
    } catch (error: unknown) {
        throw toMetaAdsError(error, what)
    }
}

function toMetaAdsError(error: unknown, what: string): Error {
    if (isFacebookRequestError(error)) {
        return new MetaAdsApiError(error.status, error.response.error_user_msg || error.response.message || `Unknown Meta error on ${what}`)
    }
    return error instanceof Error ? error : new Error(`Unexpected Meta Graph failure on ${what}`)
}

function parseNode<T>(node: unknown, itemSchema: z.ZodType<T>, what: string): T {
    const parsed = itemSchema.safeParse(toPlainNode(node))
    if (!parsed.success) {
        throw new MetaAdsPayloadError(what, z.prettifyError(parsed.error))
    }
    return parsed.data
}

// SDK edges hand back AbstractCrudObject instances whose fields live behind
// defined properties, so the plain payload has to be exported explicitly.
function toPlainNode(node: unknown): unknown {
    return isGraphNode(node) ? node.exportAllData() : node
}

function isGraphNode(value: unknown): value is GraphNode {
    return typeof value === "object" && value !== null && typeof (value as Partial<GraphNode>).exportAllData === "function"
}

function isMetaCursor(value: unknown): value is MetaCursor {
    return Array.isArray(value) && typeof (value as Partial<MetaCursor>).hasNext === "function" && typeof (value as Partial<MetaCursor>).next === "function"
}

function isFacebookRequestError(value: unknown): value is FacebookRequestErrorShape {
    if (typeof value !== "object" || value === null) {
        return false
    }
    const candidate = value as Partial<FacebookRequestErrorShape>
    return typeof candidate.status === "number" && typeof candidate.response === "object" && candidate.response !== null
}

const VIDEO_READY_TIMEOUT_MS = 5 * 60 * 1000
const VIDEO_POLL_INTERVAL_MS = 5000

/**
 * Meta encodes an uploaded video asynchronously and rejects a creative that points
 * at one still processing, so the upload is not done until the status says ready.
 */
export async function uploadMetaAdsVideo(client: MetaAdsClient, adAccountId: string, videoUrl: string, now: () => number = Date.now): Promise<string> {
    const videoId = await client.createdId(() => client.adAccount(adAccountId).createAdVideo([], { file_url: videoUrl }), "ad video")
    const deadline = now() + VIDEO_READY_TIMEOUT_MS

    for (;;) {
        const { status } = await client.runParsed(() => client.adVideo(videoId).read(["status"]), metaVideoStatusSchema, "ad video status")
        const videoStatus = status?.video_status
        if (videoStatus === "ready") {
            return videoId
        }
        if (videoStatus === "error") {
            throw new MetaAdsPayloadError("ad video status", `Meta failed to process the video at ${videoUrl}.`)
        }
        if (now() >= deadline) {
            throw new MetaAdsPayloadError("ad video status", `Meta was still processing the video at ${videoUrl} after 5 minutes. Retry once encoding finishes.`)
        }
        await delay(VIDEO_POLL_INTERVAL_MS)
    }
}

/**
 * asset_feed_spec identifies images by hash rather than URL, and /adimages takes
 * bytes rather than a URL, so the image has to travel through us.
 */
export async function uploadMetaAdsImageHash(client: MetaAdsClient, adAccountId: string, imageUrl: string): Promise<string> {
    const response = await fetch(imageUrl)
    if (!response.ok) {
        throw new MetaAdsPayloadError("ad image upload", `Could not download the image at ${imageUrl} (HTTP ${response.status}).`)
    }
    const bytes = Buffer.from(await response.arrayBuffer()).toString("base64")
    const created = await client.runParsed(() => client.adAccount(adAccountId).createAdImage(["hash"], { bytes }), metaAdImageSchema, "ad image upload")

    const hash = created.hash ?? Object.values(created.images ?? {})[0]?.hash
    if (!hash) {
        throw new MetaAdsPayloadError("ad image upload", `Meta did not return an image hash for ${imageUrl}.`)
    }
    return hash
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

const createdNodeSchema = z.object({
    id: z.string().optional(),
    post_id: z.string().optional(),
    creative_id: z.string().optional()
})

const metaVideoStatusSchema = z.object({
    status: z.object({ video_status: z.string().optional() }).optional()
})

const metaAdImageSchema = z.object({
    hash: z.string().optional(),
    images: z.record(z.string(), z.object({ hash: z.string() })).optional()
})

export const META_ADS_AD_ACCOUNT_FIELDS = ["id", "account_id", "name", "currency", "account_status"]
const META_ADS_PAGE_FIELDS = ["id", "name", "category"]

// Used by both the OAuth install flow and the agent-facing list_ad_accounts action.
export async function fetchMetaAdsAdAccounts(accessToken: string): Promise<MetaAdsAdAccountEntity[]> {
    const client = new MetaAdsClient(accessToken)
    return client.collect(() => client.me().getAdAccounts(META_ADS_AD_ACCOUNT_FIELDS, { limit: 200 }), metaAdsAdAccountEntitySchema, "ad accounts")
}

export async function fetchMetaAdsPages(accessToken: string): Promise<MetaAdsPageEntity[]> {
    const client = new MetaAdsClient(accessToken)
    return client.collect(() => client.me().getAccounts(META_ADS_PAGE_FIELDS, { limit: 200 }), metaAdsPageSchema, "pages")
}

/**
 * A system user token resolves `/me` to the system user rather than a person, and Meta
 * returns `client_business_id` there instead of a usable name, so fall back to naming the
 * client business.
 */
export async function fetchMetaAdsConnectionName(accessToken: string): Promise<string | null> {
    const client = new MetaAdsClient(accessToken)
    const me = await client.runParsed(() => client.me().get(["name", "client_business_id"]), metaMeSchema, "token owner")
    if (me.name) {
        return me.name
    }
    if (!me.client_business_id) {
        return null
    }
    const business = await client.runParsed(() => client.business(me.client_business_id!).get(["name"]), metaBusinessSchema, "client business")
    return business.name ?? null
}

const metaMeSchema = z.object({ name: z.string().nullable().optional(), client_business_id: z.string().nullable().optional() })
const metaBusinessSchema = z.object({ name: z.string().nullable().optional() })

export function toActPath(adAccountId: string): string {
    return adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
}

export function hashEmail(email: string): string {
    return sha256(email.trim().toLowerCase())
}

// Meta matches on country code with no leading zeros, so a trunk prefix like 0044 or
// a national leading 0 has to go before hashing or the number silently fails to match.
export function hashPhone(phone: string): string {
    return sha256(phone.replace(/[^0-9]/g, "").replace(/^0+/, ""))
}

function sha256(value: string): string {
    return crypto.createHash("sha256").update(value).digest("hex")
}

export class MetaAdsAuthError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "MetaAdsAuthError"
    }
}

export class MetaAdsApiError extends Error {
    constructor(
        readonly status: number,
        message: string
    ) {
        super(`Meta Graph API error (${status}): ${message}`)
        this.name = "MetaAdsApiError"
    }
}

export class MetaAdsPayloadError extends Error {
    constructor(what: string, detail: string) {
        super(`Meta returned an unexpected ${what} payload. ${detail}`)
        this.name = "MetaAdsPayloadError"
    }
}

export interface MetaAdsPagedResult<T> {
    readonly items: T[]
    readonly truncated: boolean
}

type EdgeFetch = () => unknown

interface MetaCursor extends Array<unknown> {
    hasNext(): boolean
    next(): unknown
}

interface GraphNode {
    exportAllData(): Record<string, unknown>
}

interface FacebookRequestErrorShape {
    status: number
    response: { message?: string; error_user_msg?: string }
}
