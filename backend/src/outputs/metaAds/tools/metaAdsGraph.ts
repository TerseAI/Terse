import crypto from "crypto"
import { metaAdsAdAccountEntitySchema } from "terse-types"
import type { MetaAdsAdAccountEntity } from "terse-types"
import { z } from "zod"

import { settings } from "../../../settings"

const META_GRAPH_API_BASE = "https://graph.facebook.com/v23.0"

export async function metaGraphRequest<T>(accessToken: string, path: string, schema: z.ZodType<T>, what: string, options: MetaGraphRequestOptions = {}): Promise<T> {
    const payload = await metaGraphRawRequest(accessToken, path, options)
    const parsed = schema.safeParse(payload)
    if (!parsed.success) {
        throw new MetaAdsPayloadError(what, parsed.error)
    }
    return parsed.data
}

export async function metaGraphList<T>(accessToken: string, path: string, itemSchema: z.ZodType<T>, what: string, options: MetaGraphRequestOptions = {}): Promise<T[]> {
    const envelope = z.object({ data: z.array(itemSchema) })
    const parsed = await metaGraphRequest(accessToken, path, envelope, what, options)
    return parsed.data
}

export async function metaGraphListPaged<T>(accessToken: string, path: string, itemSchema: z.ZodType<T>, what: string, maxItems: number): Promise<MetaGraphPagedResult<T>> {
    const envelope = z.object({
        data: z.array(itemSchema),
        paging: z.object({ next: z.string().optional() }).optional()
    })

    const items: T[] = []
    let payload = await metaGraphRawRequest(accessToken, path, {})
    for (;;) {
        const parsed = envelope.safeParse(payload)
        if (!parsed.success) {
            throw new MetaAdsPayloadError(what, parsed.error)
        }
        items.push(...parsed.data.data)

        // paging.next is a complete URL that already carries access_token and appsecret_proof.
        const next = parsed.data.paging?.next
        if (!next) {
            return { items, truncated: false }
        }
        if (items.length >= maxItems) {
            return { items: items.slice(0, maxItems), truncated: true }
        }
        payload = await metaGraphFollowNext(next, what)
    }
}

async function metaGraphFollowNext(nextUrl: string, what: string): Promise<unknown> {
    const response = await fetch(nextUrl)
    const responseText = await response.text()
    if (!response.ok) {
        throw new MetaAdsApiError(response.status, extractGraphErrorMessage(responseText))
    }
    if (!responseText) {
        throw new MetaAdsApiError(response.status, `Empty ${what} page from Meta Graph API pagination`)
    }
    return JSON.parse(responseText)
}

export async function fetchMetaAdsAdAccounts(accessToken: string): Promise<MetaAdsAdAccountEntity[]> {
    return metaGraphList(accessToken, "/me/adaccounts?fields=id,account_id,name,currency,account_status&limit=200", metaAdsAdAccountEntitySchema, "ad accounts")
}

export function toActPath(adAccountId: string): string {
    return adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
}

export function buildMetaQuery(params: Record<string, string | number | null | undefined>): string {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
        if (value !== null && value !== undefined) query.set(key, String(value))
    }
    const rendered = query.toString()
    return rendered ? `?${rendered}` : ""
}

export function hashEmail(email: string): string {
    return sha256(email.trim().toLowerCase())
}

export function hashPhone(phone: string): string {
    return sha256(phone.replace(/[^0-9]/g, ""))
}

async function metaGraphRawRequest(accessToken: string, path: string, options: MetaGraphRequestOptions): Promise<unknown> {
    const url = new URL(`${META_GRAPH_API_BASE}${path}`)
    url.searchParams.set("access_token", accessToken)
    const proof = appSecretProof(accessToken)
    if (proof) {
        url.searchParams.set("appsecret_proof", proof)
    }

    const response = await fetch(url, {
        method: options.method ?? "GET",
        ...(options.body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(options.body) } : {})
    })

    const responseText = await response.text()
    if (!response.ok) {
        throw new MetaAdsApiError(response.status, extractGraphErrorMessage(responseText))
    }
    return responseText ? JSON.parse(responseText) : undefined
}

function appSecretProof(accessToken: string): string | undefined {
    const clientSecret = settings.metaAds?.clientSecret
    if (!clientSecret) return undefined
    return crypto.createHmac("sha256", clientSecret).update(accessToken).digest("hex")
}

const graphErrorEnvelopeSchema = z.object({
    error: z.object({
        message: z.string(),
        type: z.string().optional(),
        code: z.number().optional(),
        error_user_msg: z.string().optional()
    })
})

function extractGraphErrorMessage(responseText: string): string {
    try {
        const parsed = graphErrorEnvelopeSchema.safeParse(JSON.parse(responseText))
        if (parsed.success) {
            return parsed.data.error.error_user_msg || parsed.data.error.message
        }
    } catch {
        // fall through to raw text
    }
    return responseText.trim() || "Unknown Meta Graph API error"
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
    constructor(what: string, error: z.ZodError) {
        super(`Meta returned an unexpected ${what} payload. ${z.prettifyError(error)}`)
        this.name = "MetaAdsPayloadError"
    }
}

export interface MetaGraphRequestOptions {
    readonly method?: "GET" | "POST" | "DELETE"
    readonly body?: unknown
}

export interface MetaGraphPagedResult<T> {
    readonly items: T[]
    readonly truncated: boolean
}
