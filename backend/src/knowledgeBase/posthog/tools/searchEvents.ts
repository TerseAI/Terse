import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import logger from "../../../logger"
import { IntegrationType } from "../../../shared/Integrations"
import { ToolName } from "../../../tools/ToolNames"
import { Session } from "../../../types/session"
import { getPosthogApiKeyByIntegrationId } from "../posthogApiClient"

/**
 * Tool for querying PostHog analytics events.
 * This tool queries the PostHog Events API to find custom analytics events like pageviews, button clicks, and other tracked actions.
 */
export const searchEventsTool = tool({
    name: ToolName.POSTHOG_SEARCH_EVENTS,
    description:
        "Query PostHog analytics events. Use countByEventNameOnly: true (default) to get counts per event name. Use customEventsOnly: true (default) to exclude PostHog built-in events (names starting with $) and return only the project's custom-tracked events. Works for any PostHog project.",
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the PostHog knowledge base to use."),
        projectId: z.string().describe("The PostHog project ID."),
        countByEventNameOnly: z.boolean().default(true).describe("If true (default), returns only event names and their counts. If false, returns full event list (larger response)."),
        customEventsOnly: z
            .boolean()
            .default(true)
            .describe(
                "If true (default), only include custom events (exclude PostHog built-in events whose names start with $, e.g. $pageview, $autocapture). If false, include all events. Use true to get counts for events the project actually tracks (works for any user's project)."
            ),
        userEmail: z.union([z.string(), z.null()]).optional().describe('Optional: User email to filter events by (e.g., "user@example.com").'),
        eventName: z.union([z.string(), z.null()]).optional().describe('Optional: Specific event name to filter by (e.g., "$pageview", "button_clicked", "form_submitted").'),
        propertyFilters: z
            .union([
                z.array(
                    z.object({
                        key: z.string().describe("Property key to filter on"),
                        value: z.union([z.string(), z.number(), z.boolean()]).describe("Property value to match"),
                        operator: z.enum(["exact", "is_not", "icontains", "not_icontains", "gt", "lt", "gte", "lte"]).default("exact").describe("Comparison operator")
                    })
                ),
                z.null()
            ])
            .optional()
            .describe("Optional: Array of property filters to apply. Each filter has a key, value, and operator."),
        limit: z.number().default(50).describe("Maximum number of events to return when countByEventNameOnly is false (default: 50, max: 100). Ignored when countByEventNameOnly is true."),
        offset: z.number().default(0).describe("Offset for pagination when countByEventNameOnly is false (default: 0). Ignored when countByEventNameOnly is true."),
        last7Days: z
            .boolean()
            .default(false)
            .describe(
                "If true and dateFrom is not provided, filters events from the last 7 days only (default: false). If false, no date restriction is applied unless dateFrom is explicitly provided."
            ),
        dateFrom: z
            .union([z.string(), z.null()])
            .describe(
                'Start date for filtering. MUST be formatted as "YYYY-MM-DD HH:mm:ss" in UTC (e.g. "2026-02-06 14:00:00"). Do NOT use ISO format with T/Z (e.g. 2026-02-07T22:52:34Z) and do NOT use relative strings like "-7d". If not provided and last7Days is true, defaults to 7 days ago. If not provided and last7Days is false, no date restriction is applied.'
            ),
        dateTo: z
            .union([z.string(), z.null()])
            .describe(
                'End date for filtering. MUST be formatted as "YYYY-MM-DD HH:mm:ss" in UTC (e.g. "2026-02-07 14:00:00"). Do NOT use ISO format with T/Z and do NOT use relative strings like "now". If not provided, defaults to now.'
            )
    }),
    execute: async (
        { integrationId, projectId, countByEventNameOnly = true, customEventsOnly = true, userEmail, eventName, propertyFilters, limit = 50, offset = 0, last7Days = false, dateFrom, dateTo },
        runContext?: RunContext<SessionWithTracking<Session>>
    ) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        // Normalize null to undefined for easier handling
        const normalizedUserEmail = userEmail ?? undefined
        const normalizedEventName = eventName ?? undefined
        const normalizedPropertyFilters = propertyFilters ?? undefined

        const posthogApiKey = await getPosthogApiKeyByIntegrationId(integrationId, runContext.context.user.id)
        if (!posthogApiKey) {
            throw new Error(`PostHog integration not found or access denied for integrationId: ${integrationId}`)
        }

        const posthogHost = "https://us.posthog.com"

        try {
            // Calculate date filters
            // All timestamps must be in "YYYY-MM-DD HH:mm:ss" UTC format for PostHog compatibility
            let dateFromValue: string | null = dateFrom ?? null
            let dateToValue: string | null = dateTo ?? null

            // Default to last 7 days if last7Days is true and dateFrom is not provided
            if (last7Days && !dateFromValue) {
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                dateFromValue = formatPosthogTimestamp(sevenDaysAgo)
            }

            logger.info("Querying PostHog events", {
                userEmail: normalizedUserEmail,
                eventName: normalizedEventName,
                projectId,
                countByEventNameOnly,
                customEventsOnly,
                limit,
                offset,
                dateFrom: dateFromValue
            })

            // Counts-only path: use HogQL to return just event name -> count (small response, no context overflow)
            if (countByEventNameOnly) {
                const eventsLink = `${posthogHost}/project/${projectId}/events`
                const whereParts: string[] = []
                if (dateFromValue) {
                    whereParts.push(`timestamp >= '${dateFromValue}'`)
                }
                if (dateToValue) {
                    whereParts.push(`timestamp <= '${dateToValue}'`)
                }
                if (normalizedEventName) {
                    whereParts.push(`event = '${normalizedEventName.replace(/'/g, "''")}'`)
                }
                // Exclude PostHog built-in events (names start with $). Custom events = what the project tracks.
                if (customEventsOnly) {
                    // Use LIKE for broader compatibility (works in ClickHouse/HogQL)
                    whereParts.push("event NOT LIKE '$%'")
                }
                const whereClause = whereParts.length > 0 ? ` WHERE ${whereParts.join(" AND ")}` : ""
                const hogql = `SELECT event, count() as count FROM events${whereClause} GROUP BY event ORDER BY count DESC LIMIT 500`

                const queryUrl = `${posthogHost}/api/projects/${projectId}/query/`
                const queryRes = await fetch(queryUrl, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${posthogApiKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        query: { kind: "HogQLQuery", query: hogql },
                        name: "event_counts_by_name"
                    })
                })

                if (!queryRes.ok) {
                    const errText = await queryRes.text()
                    logger.error("PostHog HogQL query error", { status: queryRes.status, error: errText, projectId })
                    if (queryRes.status === 401) {
                        throw new Error("PostHog API key is invalid or expired. Please update your PostHog integration.")
                    }
                    throw new Error(`Failed to query PostHog event counts: ${errText}`)
                }

                const queryData = (await queryRes.json()) as {
                    results?: Array<{ event?: string; count?: number } | unknown[]>
                    query_status?: { results?: Array<{ event?: string; count?: number } | unknown[]> }
                }
                const rawResults = queryData?.results ?? queryData?.query_status?.results
                const rows = Array.isArray(rawResults) ? rawResults : []
                let eventCounts = rows.map((row: { event?: string; count?: number } | unknown[]) => {
                    if (Array.isArray(row)) {
                        return { eventName: String(row[0] ?? "unknown"), count: Number(row[1] ?? 0) }
                    }
                    const r = row as { event?: string; count?: number }
                    return { eventName: r.event ?? "unknown", count: typeof r.count === "number" ? r.count : 0 }
                })

                // Client-side filter: remove $ events if customEventsOnly is true (safety net if HogQL filter didn't work)
                if (customEventsOnly) {
                    eventCounts = eventCounts.filter(e => !e.eventName.startsWith("$"))
                }

                const dateDesc = dateFromValue ? ` from ${dateFromValue}` : ""
                const eventLabel = customEventsOnly ? "custom events" : "event types"
                const action = {
                    action: "Searched PostHog event counts",
                    integration: IntegrationType.POSTHOG,
                    target: projectId,
                    details: `${eventLabel}: ${eventCounts.length}${dateDesc}. View events: ${eventsLink}`,
                    url: eventsLink,
                    type: RunHistoryActionType.read,
                    isReadOnly: true
                }

                return {
                    success: true,
                    countByEventNameOnly: true,
                    customEventsOnly,
                    eventCounts,
                    totalEventTypes: eventCounts.length,
                    eventsLink,
                    message: `Count of times each ${eventLabel} was called: ${eventCounts.length}${dateDesc}. View in PostHog: ${eventsLink}`,
                    actions: [action]
                }
            }

            // Full events path: cap limit to avoid context/tracing overflow
            const cappedLimit = Math.min(limit, 100)

            // Build query parameters
            const params = new URLSearchParams({
                limit: cappedLimit.toString(),
                offset: offset.toString()
            })

            // Add event filter
            if (normalizedEventName) {
                params.append("event", normalizedEventName)
            }

            // Add date filters
            if (dateFromValue) {
                params.append("after", dateFromValue)
            }
            if (dateToValue) {
                params.append("before", dateToValue)
            }

            // If filtering by user email, we need to add a properties filter
            // PostHog stores user email in various properties depending on setup
            if (normalizedUserEmail) {
                // Use the properties parameter to filter by email
                // PostHog typically stores this in $user_email, email, or distinct_id
                const emailFilter = JSON.stringify([
                    {
                        key: "distinct_id",
                        value: normalizedUserEmail,
                        operator: "exact",
                        type: "event"
                    }
                ])
                params.append("properties", emailFilter)
            }

            // Add property filters if provided
            if (normalizedPropertyFilters && normalizedPropertyFilters.length > 0) {
                const existingFilters = normalizedUserEmail
                    ? [
                          {
                              key: "distinct_id",
                              value: normalizedUserEmail,
                              operator: "exact",
                              type: "event"
                          }
                      ]
                    : []

                const allFilters = [
                    ...existingFilters,
                    ...normalizedPropertyFilters.map(f => ({
                        key: f.key,
                        value: f.value,
                        operator: f.operator,
                        type: "event"
                    }))
                ]

                params.set("properties", JSON.stringify(allFilters))
            }

            // Query the Events API
            const eventsQueryUrl = `${posthogHost}/api/projects/${projectId}/events/?${params.toString()}`

            const fetchResponse = await fetch(eventsQueryUrl, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${posthogApiKey}`,
                    "Content-Type": "application/json"
                }
            })

            if (!fetchResponse.ok) {
                const errorText = await fetchResponse.text()
                logger.error("PostHog events API error", {
                    status: fetchResponse.status,
                    error: errorText,
                    userEmail: normalizedUserEmail,
                    eventName: normalizedEventName,
                    projectId
                })

                if (fetchResponse.status === 401) {
                    throw new Error("PostHog API key is invalid or expired. Please update your PostHog integration.")
                } else if (fetchResponse.status === 403) {
                    throw new Error("PostHog API key does not have events:read permission. Please ensure your API key has the correct scope.")
                } else if (fetchResponse.status === 404) {
                    throw new Error(`PostHog project ${projectId} not found. Please verify the project ID in your configuration.`)
                }

                throw new Error(`Failed to query PostHog events: ${errorText}`)
            }

            const eventsData = await fetchResponse.json()

            // Build link to events UI
            const eventsLink = `${posthogHost}/project/${projectId}/events`

            // Extract and format event entries
            const eventEntries = Array.isArray(eventsData) ? eventsData : eventsData.results || eventsData.data || eventsData.events || []

            // Get pagination metadata if available
            const hasNext = eventsData.next ? true : false

            // Sort by timestamp descending (latest first) if not already sorted
            const sortedEvents = [...eventEntries].sort((a: any, b: any) => {
                const timeA = new Date(a.timestamp || a.created_at || a.time || 0).getTime()
                const timeB = new Date(b.timestamp || b.created_at || b.time || 0).getTime()
                return timeB - timeA // Descending order
            })

            // Keep payload small: only essential fields; omit full properties to avoid context/tracing overflow
            const formattedEvents = sortedEvents.map((event: any) => ({
                id: event.id || event.uuid,
                event: event.event,
                timestamp: event.timestamp || event.created_at || event.time,
                distinctId: event.distinct_id,
                url: event.properties?.$current_url || event.properties?.url
            }))

            // Determine if there are more results available
            const nextOffset = hasNext ? offset + formattedEvents.length : null

            // Build filter description for the response message
            const filterDescriptions: string[] = []
            if (normalizedUserEmail) {
                filterDescriptions.push(`user="${normalizedUserEmail}"`)
            }
            if (normalizedEventName) {
                filterDescriptions.push(`event="${normalizedEventName}"`)
            }
            if (normalizedPropertyFilters && normalizedPropertyFilters.length > 0) {
                filterDescriptions.push(`${normalizedPropertyFilters.length} property filter(s)`)
            }
            const filterDescription = filterDescriptions.length > 0 ? filterDescriptions.join(", ") : "no filters"

            const response = {
                success: true,
                userEmail: normalizedUserEmail || null,
                eventName: normalizedEventName || null,
                projectId,
                totalEvents: formattedEvents.length,
                events: formattedEvents,
                eventsLink,
                pagination: {
                    limit: cappedLimit,
                    offset,
                    hasMore: hasNext,
                    nextOffset,
                    showing: `${offset + 1}-${offset + formattedEvents.length}`
                },
                message: `Found ${formattedEvents.length} events filtered by ${filterDescription} (showing ${offset + 1}-${offset + formattedEvents.length}${hasNext ? ", more available" : ""}). View all events: ${eventsLink}`
            }

            // Return action as part of the result
            const queryDesc = normalizedEventName ? ` of type "${normalizedEventName}"` : ""
            const action = {
                action: "Searched PostHog events",
                integration: IntegrationType.POSTHOG,
                target: projectId,
                details: `Searched analytics events: Found ${formattedEvents.length} event(s)${queryDesc}${dateFromValue ? ` from ${dateFromValue}` : ""}${dateToValue ? ` to ${dateToValue}` : ""}`,
                url: eventsLink,
                type: RunHistoryActionType.read,
                isReadOnly: true
            }

            return {
                ...response,
                actions: [action]
            }
        } catch (error: any) {
            logger.error("Error querying PostHog events", { error, userEmail: normalizedUserEmail, eventName: normalizedEventName, projectId })
            throw new Error(`Failed to query PostHog events: ${error.message || "Unknown error"}`)
        }
    }
})

/**
 * Format a Date as "YYYY-MM-DD HH:mm:ss" in UTC — the only timestamp format PostHog reliably accepts.
 */
function formatPosthogTimestamp(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}
