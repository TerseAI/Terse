import { RunContext } from "@openai/agents"
import { attioAttributeSchema } from "terse-types"
import type { AttioAttribute } from "terse-types"
import { z } from "zod"

import { Session } from "../../../express"
import { AttioIntegrationManager } from "../../../integrations/attio/integration"
import { SessionWithTracking } from "../../../modules/agents/AgentRunner/BaseAgentRunner"

const ATTIO_API_BASE = "https://api.attio.com/v2"

export async function resolveAttioAccessToken(integrationId: string, runContext: RunContext<SessionWithTracking<Session>> | undefined): Promise<string> {
    if (!runContext?.context) {
        throw new Error("No context provided")
    }

    const manager = new AttioIntegrationManager()
    const orgIntegrations = await manager.getInstancesForOrganization(runContext.context.user.organizationId)
    if (!orgIntegrations.some(i => i.id === integrationId)) {
        throw new Error("Attio integration not found or not authorized for this organization.")
    }

    const accessToken = await manager.getAccessToken(integrationId)
    if (!accessToken) {
        throw new Error("Failed to get Attio access token. The integration may not be connected.")
    }
    return accessToken
}

export async function attioRequestData<T>(accessToken: string, path: string, schema: z.ZodType<T>, what: string, options: AttioApiRequestOptions = {}): Promise<T> {
    return parseAttioData(await attioApiRequest(accessToken, path, options), schema, what)
}

export async function attioWriteData<T>(accessToken: string, objectSlug: string, path: string, schema: z.ZodType<T>, what: string, options: AttioApiRequestOptions): Promise<T> {
    return parseAttioData(await attioWriteRequest(accessToken, objectSlug, path, options), schema, what)
}

export async function attioRequestPage<T>(accessToken: string, path: string, schema: z.ZodType<T>, what: string): Promise<AttioPage<T>> {
    const envelope = z.object({ data: schema, pagination: z.object({ next_cursor: z.string().nullable().optional() }).optional() })
    const parsed = envelope.safeParse(await attioApiRequest(accessToken, path))
    if (!parsed.success) {
        throw new AttioPayloadError(what, parsed.error)
    }
    return { data: parsed.data.data, nextCursor: parsed.data.pagination?.next_cursor ?? null }
}

export function parseAttioData<T>(payload: unknown, schema: z.ZodType<T>, what: string): T {
    const parsed = z.object({ data: schema }).safeParse(payload)
    if (!parsed.success) {
        throw new AttioPayloadError(what, parsed.error)
    }
    return parsed.data.data
}

export async function fetchWorkspaceSlug(accessToken: string): Promise<string | undefined> {
    try {
        const parsed = z.object({ workspace_slug: z.string() }).safeParse(await attioApiRequest(accessToken, "/self"))
        return parsed.success ? parsed.data.workspace_slug : undefined
    } catch {
        return undefined
    }
}

export function toAttioActorInput(emailOrMemberId: string): Record<string, unknown> {
    if (emailOrMemberId.includes("@")) {
        return { workspace_member_email_address: emailOrMemberId }
    }
    return { referenced_actor_type: "workspace-member", referenced_actor_id: emailOrMemberId }
}

const jsonObjectSchema = z.record(z.string(), z.unknown())

export function parseOptionalJsonObject(raw: string | null | undefined, label: string): Record<string, unknown> | undefined {
    if (!raw) return undefined
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        throw new Error(`Invalid "${label}": not valid JSON.`)
    }
    const result = jsonObjectSchema.safeParse(parsed)
    if (!result.success) {
        throw new Error(`Invalid "${label}": expected a JSON object.`)
    }
    return result.data
}

export function buildQueryString(params: Record<string, string | number | boolean | null | undefined>): string {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
        if (value !== null && value !== undefined) query.set(key, String(value))
    }
    const rendered = query.toString()
    return rendered ? `?${rendered}` : ""
}

export async function attioApiRequest(accessToken: string, path: string, options: AttioApiRequestOptions = {}): Promise<unknown> {
    const response = await fetch(`${ATTIO_API_BASE}${path}`, {
        method: options.method ?? "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            ...(options.body !== undefined ? { "Content-Type": "application/json" } : {})
        },
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {})
    })

    const responseText = await response.text()
    if (!response.ok) {
        throw new AttioApiError(response.status, responseText)
    }
    return responseText ? JSON.parse(responseText) : undefined
}

export async function attioWriteRequest(accessToken: string, objectSlug: string, path: string, options: AttioApiRequestOptions): Promise<unknown> {
    try {
        return await attioApiRequest(accessToken, path, options)
    } catch (error: unknown) {
        throw await normalizeAttioWriteError(error, accessToken, objectSlug)
    }
}

async function normalizeAttioWriteError(error: unknown, accessToken: string, objectSlug: string): Promise<Error> {
    if (!(error instanceof AttioApiError)) {
        return error instanceof Error ? error : new Error(String(error))
    }
    return new Error(await normalizeAttioErrorMessage(error.responseBody, error.status, accessToken, objectSlug))
}

export async function normalizeAttioErrorMessage(rawErrorText: string, status: number, accessToken: string, objectSlug: string): Promise<string> {
    const parsedError = parseAttioError(rawErrorText)
    if (!parsedError) {
        return rawErrorText.trim() || `Attio request failed (${status}).`
    }

    const fallbackMessage = parsedError.message || `Attio request failed (${status}).`
    const missingAttributeId = getMissingAttributeId(parsedError)
    if (!missingAttributeId) return fallbackMessage

    const attributes = await fetchAttioAttributes(accessToken, objectSlug)
    if (!attributes) {
        return `Attio is missing a required field for "${objectSlug}".`
    }

    return buildMissingFieldMessage(objectSlug, attributes, missingAttributeId)
}

function parseAttioError(rawErrorText: string): AttioApiErrorBody | null {
    try {
        const firstParse = JSON.parse(rawErrorText) as string | AttioApiErrorBody
        return typeof firstParse === "string" ? (JSON.parse(firstParse) as AttioApiErrorBody) : firstParse
    } catch {
        return null
    }
}

function getMissingAttributeId(parsedError: AttioApiErrorBody): string | undefined {
    if (parsedError.code !== "missing_value") return undefined
    return parsedError.message?.match(/attribute with ID "([^"]+)"/)?.[1]
}

async function fetchAttioAttributes(accessToken: string, objectSlug: string): Promise<AttioAttribute[] | null> {
    const response = await fetch(`${ATTIO_API_BASE}/objects/${encodeURIComponent(objectSlug)}/attributes`, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    })

    if (!response.ok) return null

    const parsed = z.object({ data: z.array(attioAttributeSchema) }).safeParse(await response.json())
    return parsed.success ? parsed.data.data : []
}

function getAttributeId(attribute: AttioAttribute): string | undefined {
    const rawId = attribute.id
    if (typeof rawId === "string") return rawId
    if (!rawId || typeof rawId !== "object") return undefined
    return typeof (rawId as Record<string, unknown>).attribute_id === "string" ? ((rawId as Record<string, unknown>).attribute_id as string) : undefined
}

function formatRequiredFields(attributes: AttioAttribute[]): string[] {
    return attributes
        .filter(attribute => attribute.is_required && attribute.api_slug)
        .map(attribute => (attribute.title ? `${attribute.title} (${attribute.api_slug})` : (attribute.api_slug as string)))
}

function findAttributeById(attributes: AttioAttribute[], attributeId: string): AttioAttribute | undefined {
    return attributes.find(attribute => getAttributeId(attribute) === attributeId)
}

function buildMissingFieldMessage(objectSlug: string, attributes: AttioAttribute[], missingAttributeId: string): string {
    const requiredFields = formatRequiredFields(attributes)
    const missingAttribute = findAttributeById(attributes, missingAttributeId)

    if (missingAttribute?.api_slug) {
        const fieldLabel = missingAttribute.title ? `${missingAttribute.title} (${missingAttribute.api_slug})` : missingAttribute.api_slug
        return requiredFields.length > 0
            ? `Attio requires "${fieldLabel}" before this record can be created. Required fields for ${objectSlug}: ${requiredFields.join(", ")}.`
            : `Attio requires "${fieldLabel}" before this record can be created.`
    }

    return requiredFields.length > 0
        ? `Attio is missing a required field for "${objectSlug}". Required fields: ${requiredFields.join(", ")}.`
        : `Attio is missing a required field for "${objectSlug}".`
}

export class AttioApiError extends Error {
    constructor(
        readonly status: number,
        readonly responseBody: string
    ) {
        super(`Attio API error (${status}): ${responseBody}`)
        this.name = "AttioApiError"
    }
}

export class AttioPayloadError extends Error {
    constructor(what: string, error: z.ZodError) {
        super(`Attio returned an unexpected ${what} payload. ${z.prettifyError(error)}`)
        this.name = "AttioPayloadError"
    }
}

type AttioApiErrorBody = {
    code?: string
    message?: string
}

export interface AttioApiRequestOptions {
    readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
    readonly body?: unknown
}

export interface AttioPage<T> {
    readonly data: T
    readonly nextCursor: string | null
}
