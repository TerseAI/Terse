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
        "Query PostHog analytics events to find pageviews, button clicks, and other tracked user actions. Returns events data and a link to view events in PostHog. You can filter by event name, user email, custom properties, or combinations. Use this when you need to investigate specific user actions, find patterns in user behavior, or understand what events were triggered. Different from session recordings - this shows discrete tracked events.",
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the PostHog knowledge base to use."),
        projectId: z.string().describe("The PostHog project ID."),
        userEmail: z.union([z.string(), z.null()]).optional().describe('Optional: User email to filter events by (e.g., "user@example.com").'),
        eventName: z
            .union([z.string(), z.null()])
            .optional()
            .describe('Optional: Specific event name to filter by (e.g., "$pageview", "button_clicked", "form_submitted").'),
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
        limit: z.number().default(50).describe("Maximum number of events to return (default: 50, max: 250)"),
        offset: z.number().default(0).describe("Offset for pagination (default: 0). Use with limit to page through results."),
        last7Days: z
            .boolean()
            .default(false)
            .describe(
                "If true and dateFrom is not provided, filters events from the last 7 days only (default: false). If false, no date restriction is applied unless dateFrom is explicitly provided."
            ),
        dateFrom: z
            .union([z.string(), z.null()])
            .describe(
                'Start date for filtering (ISO format or relative like "-7d"). If not provided and last7Days is true, defaults to 7 days ago. If not provided and last7Days is false, no date restriction is applied.'
            ),
        dateTo: z.union([z.string(), z.null()]).describe('End date for filtering (ISO format or relative like "now"). If not provided, defaults to now.')
    }),
    execute: async (
        { integrationId, projectId, userEmail, eventName, propertyFilters, limit = 50, offset = 0, last7Days = false, dateFrom, dateTo },
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
            let dateFromValue: string | null = dateFrom ?? null
            let dateToValue: string | null = dateTo ?? null

            // Default to last 7 days if last7Days is true and dateFrom is not provided
            if (last7Days && !dateFromValue) {
                dateFromValue = "-7d"
            }

            logger.info("Querying PostHog events", {
                userEmail: normalizedUserEmail,
                eventName: normalizedEventName,
                projectId,
                limit,
                offset,
                dateFrom: dateFromValue
            })

            // Build query parameters
            const params = new URLSearchParams({
                limit: Math.min(limit, 250).toString(),
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

            const formattedEvents = sortedEvents.map((event: any) => ({
                id: event.id || event.uuid,
                event: event.event,
                timestamp: event.timestamp || event.created_at || event.time,
                distinctId: event.distinct_id,
                properties: event.properties || {},
                personId: event.person?.uuid || event.person_id,
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
                    limit: Math.min(limit, 250),
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
