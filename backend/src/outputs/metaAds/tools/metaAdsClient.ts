import crypto from "crypto"
import { Ad, AdAccount, AdSet, AdsPixel, Campaign, CustomAudience, FacebookAdsApi, User } from "facebook-nodejs-business-sdk"
import { metaAdsAdAccountEntitySchema } from "terse-types"
import type { MetaAdsAdAccountEntity } from "terse-types"
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

    // Writes return the created node; only its id is guaranteed to be populated.
    async createdId(create: () => Promise<{ id: string }>, what: string): Promise<string> {
        const created = await runGraph(create, what)
        if (!created.id) {
            throw new MetaAdsPayloadError(what, "Meta did not return an id for the created object.")
        }
        return created.id
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

export const META_ADS_AD_ACCOUNT_FIELDS = ["id", "account_id", "name", "currency", "account_status"]

// Used by both the OAuth install flow and the agent-facing list_ad_accounts action.
export async function fetchMetaAdsAdAccounts(accessToken: string): Promise<MetaAdsAdAccountEntity[]> {
    const client = new MetaAdsClient(accessToken)
    return client.collect(() => client.me().getAdAccounts(META_ADS_AD_ACCOUNT_FIELDS, { limit: 200 }), metaAdsAdAccountEntitySchema, "ad accounts")
}

export async function fetchMetaAdsUserName(accessToken: string): Promise<string | null> {
    const client = new MetaAdsClient(accessToken)
    const me = await client.runParsed(() => client.me().get(["name"]), metaUserSchema, "user profile")
    return me.name ?? null
}

const metaUserSchema = z.object({ name: z.string().nullable().optional() })

export function toActPath(adAccountId: string): string {
    return adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
}

export function hashEmail(email: string): string {
    return sha256(email.trim().toLowerCase())
}

export function hashPhone(phone: string): string {
    return sha256(phone.replace(/[^0-9]/g, ""))
}

function sha256(value: string): string {
    return crypto.createHash("sha256").update(value).digest("hex")
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
