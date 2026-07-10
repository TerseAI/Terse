import type { AttioAttribute } from "terse-types"

const ATTIO_API_BASE = "https://api.attio.com/v2"

export async function attioApiRequest<T>(accessToken: string, path: string, options: AttioApiRequestOptions = {}): Promise<T> {
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
    return (responseText ? JSON.parse(responseText) : undefined) as T
}

export async function attioWriteRequest<T>(accessToken: string, objectSlug: string, path: string, options: AttioApiRequestOptions): Promise<T> {
    try {
        return await attioApiRequest<T>(accessToken, path, options)
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

    const data = (await response.json()) as { data?: AttioAttribute[] }
    return data.data || []
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

type AttioApiErrorBody = {
    code?: string
    message?: string
}

export interface AttioApiRequestOptions {
    readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
    readonly body?: unknown
}
