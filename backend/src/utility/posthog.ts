import { PosthogPropertyFilter } from "terse-types"

import logger from "../common/logger"

// Terse supports US PostHog Cloud only. EU-hosted PostHog (eu.posthog.com) is not supported.
export const POSTHOG_HOST = "https://us.posthog.com"

export interface PosthogEventFilters {
    eventName?: string | null
    customEventsOnly?: boolean
    distinctId?: string | null
    propertyFilters?: PosthogPropertyFilterInput[] | null
    dateFrom?: string | null
    dateTo?: string | null
    beforeTimestamp?: string | null
}

export interface PosthogPropertyFilterInput {
    key: string
    value: string | number | boolean
    operator?: PosthogPropertyFilter["operator"]
    type?: PosthogPropertyFilter["type"]
}

export function buildPosthogEventsWhere(filters: PosthogEventFilters): { whereClause: string; values: Record<string, string | number> } {
    const whereParts: string[] = []
    const values: Record<string, string | number> = {}

    const dateFrom = filters.dateFrom ? resolvePosthogDate(filters.dateFrom) : null
    if (dateFrom) {
        whereParts.push("timestamp >= {date_from}")
        values.date_from = dateFrom
    }
    const dateTo = filters.dateTo ? resolvePosthogDate(filters.dateTo) : null
    if (dateTo) {
        whereParts.push("timestamp <= {date_to}")
        values.date_to = dateTo
    }
    const beforeTimestamp = filters.beforeTimestamp ? resolvePosthogCursor(filters.beforeTimestamp) : null
    if (beforeTimestamp) {
        whereParts.push("timestamp < {before_timestamp}")
        values.before_timestamp = beforeTimestamp
    }
    if (filters.eventName) {
        whereParts.push("event = {event_name}")
        values.event_name = filters.eventName
    } else if (filters.customEventsOnly ?? true) {
        whereParts.push("event NOT LIKE '$%'")
    }
    if (filters.distinctId) {
        whereParts.push("distinct_id = {distinct_id}")
        values.distinct_id = filters.distinctId
    }
    for (const [index, filter] of (filters.propertyFilters ?? []).entries()) {
        whereParts.push(buildPropertyFilterClause(filter, index, values))
    }

    return { whereClause: whereParts.length > 0 ? ` WHERE ${whereParts.join(" AND ")}` : "", values }
}

export interface PosthogEventCount {
    eventName: string
    count: number
}

export async function fetchPosthogEventCounts(projectId: string, apiKey: string, filters: PosthogEventFilters, limit: number): Promise<PosthogEventCount[]> {
    const { whereClause, values } = buildPosthogEventsWhere(filters)
    const hogql = `SELECT event, count() AS count FROM events${whereClause} GROUP BY event ORDER BY count DESC LIMIT ${limit}`
    const rows = await runPosthogHogqlQuery(projectId, apiKey, hogql, values)
    return rows.map(row => ({ eventName: String(row[0] ?? ""), count: Number(row[1] ?? 0) })).filter(event => event.eventName)
}

export async function runPosthogHogqlQuery(projectId: string, apiKey: string, hogql: string, values: Record<string, string | number>): Promise<unknown[][]> {
    const response = await fetch(`${POSTHOG_HOST}/api/projects/${projectId}/query/`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ query: { kind: "HogQLQuery", query: hogql, values } })
    })

    if (!response.ok) {
        const errorText = await response.text()
        logger.error("PostHog HogQL query error", { status: response.status, error: errorText, projectId })
        if (response.status === 401) {
            throw new Error("PostHog API key is invalid or expired. Please update your PostHog integration.")
        }
        if (response.status === 403) {
            throw new Error("PostHog API key does not have query:read permission. Please ensure your API key has the correct scope.")
        }
        if (response.status === 404) {
            throw new Error(`PostHog project ${projectId} not found. Please verify the project ID in your configuration.`)
        }
        throw new Error(`PostHog query failed: ${errorText}`)
    }

    const data = (await response.json()) as { results?: unknown[]; columns?: string[] }
    const rows = Array.isArray(data.results) ? data.results : []
    return rows.map(row => normalizeHogqlRow(row, data.columns))
}

export function posthogEventsLink(projectId: string): string {
    return `${POSTHOG_HOST}/project/${projectId}/events`
}

function normalizeHogqlRow(row: unknown, columns: string[] | undefined): unknown[] {
    if (Array.isArray(row)) return row
    if (row && typeof row === "object") {
        const record = row as Record<string, unknown>
        if (columns && columns.length > 0) return columns.map(column => record[column])
        return Object.values(record)
    }
    return []
}

function buildPropertyFilterClause(filter: PosthogPropertyFilterInput, index: number, values: Record<string, string | number>): string {
    const accessor = (filter.type ?? "event") === "person" ? `person.properties[${hogqlStringLiteral(filter.key)}]` : `properties[${hogqlStringLiteral(filter.key)}]`
    const placeholder = `filter_${index}`
    const operator = filter.operator ?? "exact"

    switch (operator) {
        case "exact":
        case "is_not": {
            const comparator = operator === "exact" ? "=" : "!="
            if (typeof filter.value === "number") {
                values[placeholder] = filter.value
                return `toFloat(${accessor}) ${comparator} {${placeholder}}`
            }
            // Event properties surface as strings in HogQL, so booleans compare as "true"/"false"
            values[placeholder] = String(filter.value)
            return `${accessor} ${comparator} {${placeholder}}`
        }
        case "icontains":
        case "not_icontains":
            values[placeholder] = `%${String(filter.value)}%`
            return `${accessor} ${operator === "icontains" ? "ILIKE" : "NOT ILIKE"} {${placeholder}}`
        case "gt":
        case "gte":
        case "lt":
        case "lte": {
            const comparator = { gt: ">", gte: ">=", lt: "<", lte: "<=" }[operator]
            if (typeof filter.value === "number") {
                values[placeholder] = filter.value
                return `toFloat(${accessor}) ${comparator} {${placeholder}}`
            }
            values[placeholder] = String(filter.value)
            return `${accessor} ${comparator} {${placeholder}}`
        }
    }
}

function hogqlStringLiteral(value: string): string {
    return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`
}

/**
 * Accepts "YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD", ISO with T/Z, "now", or relative offsets
 * like "-30m", "-24h", "-7d", "-2w", and returns the "YYYY-MM-DD HH:mm:ss" UTC format
 * PostHog reliably accepts.
 */
function resolvePosthogDate(value: string): string {
    const trimmed = value.trim()
    const relative = /^-(\d+)([mhdw])$/i.exec(trimmed)
    if (relative) {
        const unitMs = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 }[relative[2].toLowerCase() as "m" | "h" | "d" | "w"]
        return formatPosthogTimestamp(new Date(Date.now() - Number(relative[1]) * unitMs))
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed} 00:00:00`
    if (trimmed.toLowerCase() === "now") return formatPosthogTimestamp(new Date())
    if (trimmed.includes("T")) {
        const parsed = new Date(trimmed)
        if (!Number.isNaN(parsed.getTime())) return formatPosthogTimestamp(parsed)
    }
    return trimmed
}

function resolvePosthogCursor(value: string): string {
    const parsed = new Date(value.trim())
    if (Number.isNaN(parsed.getTime())) return resolvePosthogDate(value)
    return `${formatPosthogTimestamp(parsed)}.${String(parsed.getUTCMilliseconds()).padStart(3, "0")}`
}

function formatPosthogTimestamp(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}
