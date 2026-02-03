import { client, v2 } from "@datadog/datadog-api-client"
import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import logger from "../../../logger"
import { IntegrationType } from "../../../shared/Integrations"
import { ToolName } from "../../../tools/ToolNames"
import { Session } from "../../../types/session"
import { getDatadogRumDeepLink, getDatadogSite, parseDatadogTimeString } from "../../../utility/datadog"
import { getDatadogCredentialsByIntegrationId } from "../datadogApiClient"

/**
 * Tool for listing Datadog RUM events using the simple GET endpoint.
 * This tool queries the Datadog RUM API v2 GET endpoint to retrieve recent RUM events.
 * Use this to discover what RUM events exist, especially when it's ambiguous what you should be querying on.
 * Great for exploration before crafting specific search queries.
 */
export const listRumEventsTool = tool({
    name: ToolName.DATADOG_LIST_RUM_EVENTS,
    description: "List recent Datadog RUM events. Use for discovery when unsure what to query. Returns sessions, views, actions, errors, resources, long tasks.",
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Datadog knowledge base to use."),
        query: z.union([z.string(), z.null()]).optional().describe("Datadog RUM search query to filter events (e.g., @type:view)"),
        from: z.union([z.string(), z.null()]).optional().describe('Minimum timestamp (ISO8601 only, e.g., "2020-09-17T11:48:36+01:00")'),
        to: z.union([z.string(), z.null()]).optional().describe("Maximum timestamp (ISO8601 only). Defaults to now if not provided."),
        limit: z.number().default(25).describe("Maximum number of RUM events to return (default: 25, max: 1000)"),
        pageCursor: z.union([z.string(), z.null()]).optional().describe("Pagination cursor from previous response"),
        sort: z.enum(["timestamp", "-timestamp"]).default("timestamp").describe('Sort order: "timestamp" (ascending) or "-timestamp" (descending)')
    }),
    execute: async ({ integrationId, query, from, to, limit = 25, pageCursor, sort = "timestamp" }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const credentials = await getDatadogCredentialsByIntegrationId(integrationId, runContext.context.user.id)
        if (!credentials) {
            throw new Error(`Datadog integration not found or access denied for integrationId: ${integrationId}`)
        }

        const { apiKey, appKey, region } = credentials
        const site = getDatadogSite(region)

        try {
            // Configure Datadog client
            const configuration = client.createConfiguration({
                authMethods: {
                    apiKeyAuth: apiKey,
                    appKeyAuth: appKey
                }
            })
            configuration.setServerVariables({
                site: site
            })

            const rumApi = new v2.RUMApi(configuration)

            // Build request parameters for GET endpoint (query string format)
            // Only ISO8601 date strings are supported (not relative time formats like "now-15m")
            let parsedFrom: Date | undefined
            let parsedTo: Date | undefined

            if (from) {
                try {
                    parsedFrom = parseDatadogTimeString(from)
                    logger.debug("[Datadog] listRumEvents - Parsed time string", {
                        original: from,
                        parsed: parsedFrom.toISOString()
                    })
                } catch (parseError: any) {
                    logger.warn("[Datadog] listRumEvents - Time string parse error", {
                        original: from,
                        error: parseError.message
                    })
                    throw parseError
                }
            }

            if (to) {
                try {
                    parsedTo = parseDatadogTimeString(to)
                    logger.debug("[Datadog] listRumEvents - Parsed time string", {
                        original: to,
                        parsed: parsedTo.toISOString()
                    })
                } catch (parseError: any) {
                    logger.warn("[Datadog] listRumEvents - Time string parse error", {
                        original: to,
                        error: parseError.message
                    })
                    throw parseError
                }
            }

            const params: v2.RUMApiListRUMEventsRequest = {
                filterQuery: query || undefined,
                filterFrom: parsedFrom,
                filterTo: parsedTo,
                sort: sort as "timestamp" | "-timestamp",
                pageCursor: pageCursor || undefined,
                pageLimit: Math.min(limit, 1000) // Datadog max is 1000
            }

            logger.info("Listing Datadog RUM events", {
                query,
                from,
                to,
                limit,
                cursor: pageCursor ? "present" : "none",
                region
            })

            // Log full request context (debug level)
            logger.debug("[Datadog] listRumEvents - Request details", {
                tool: "listRumEvents",
                integrationId,
                userId: runContext.context.user.id,
                requestParams: {
                    query: query || null,
                    from,
                    to,
                    parsedFrom: parsedFrom?.toISOString(),
                    parsedTo: parsedTo?.toISOString(),
                    limit: Math.min(limit, 1000),
                    sort,
                    pageCursor: pageCursor ? "present" : "none"
                },
                region,
                site
            })

            // Call Datadog RUM API GET endpoint
            const response = await rumApi.listRUMEvents(params)

            // Parse response
            const eventsData = response.data || []
            const meta = response.meta

            // Format RUM event entries - RUM events have different structures based on type
            const formattedEvents = eventsData.map((event: any) => {
                const attrs = event.attributes || {}
                const eventType = attrs.type || "unknown"

                // Base event structure
                const formatted: any = {
                    id: event.id,
                    type: eventType,
                    timestamp: attrs.date || attrs.timestamp
                }

                // Add type-specific attributes
                if (eventType === "session") {
                    formatted.session = {
                        id: attrs.session?.id,
                        type: attrs.session?.type,
                        hasReplay: attrs.session?.has_replay,
                        duration: attrs.session?.duration
                    }
                } else if (eventType === "view") {
                    formatted.view = {
                        id: attrs.view?.id,
                        name: attrs.view?.name,
                        url: attrs.view?.url,
                        loadTime: attrs.view?.loading_time,
                        timeSpent: attrs.view?.time_spent
                    }
                } else if (eventType === "action") {
                    formatted.action = {
                        id: attrs.action?.id,
                        type: attrs.action?.type,
                        target: attrs.action?.target,
                        loadingTime: attrs.action?.loading_time
                    }
                } else if (eventType === "error") {
                    formatted.error = {
                        id: attrs.error?.id,
                        message: attrs.error?.message,
                        source: attrs.error?.source,
                        stack: attrs.error?.stack,
                        type: attrs.error?.type
                    }
                } else if (eventType === "resource") {
                    formatted.resource = {
                        id: attrs.resource?.id,
                        type: attrs.resource?.type,
                        url: attrs.resource?.url,
                        method: attrs.resource?.method,
                        statusCode: attrs.resource?.status_code,
                        duration: attrs.resource?.duration
                    }
                } else if (eventType === "long_task") {
                    formatted.longTask = {
                        id: attrs.long_task?.id,
                        duration: attrs.long_task?.duration
                    }
                }

                // Add common attributes
                formatted.service = attrs.service
                formatted.version = attrs.version
                formatted.environment = attrs.env
                formatted.device = attrs.device
                formatted.os = attrs.os
                formatted.browser = attrs.browser
                formatted.user = attrs.user
                formatted.view = formatted.view || attrs.view // Fallback if view exists but not in view type
                formatted.tags = attrs.tags || []
                formatted.customAttributes = attrs.attributes || {}

                return formatted
            })

            // Build deep link to Datadog RUM UI with query parameters
            const rumLink = getDatadogRumDeepLink(region, query, from, to)

            // Determine if there are more results available
            const nextCursor = meta?.page?.after || null
            const hasMore = !!nextCursor

            // Build filter description for the response message
            const filterDescriptions: string[] = []
            if (query) {
                filterDescriptions.push(`query="${query}"`)
            }
            if (from) {
                filterDescriptions.push(`from: ${from}`)
            }
            if (to) {
                filterDescriptions.push(`to: ${to}`)
            }
            const filterDescription = filterDescriptions.length > 0 ? filterDescriptions.join(", ") : "no filters (recent events)"

            // Include warnings if present
            const warnings = meta?.warnings || []
            const warningMessages = warnings.map((w: any) => `${w.title}: ${w.detail}`).join("; ")

            // Count events by type for summary
            const eventsByType: Record<string, number> = {}
            formattedEvents.forEach((event: any) => {
                const type = event.type || "unknown"
                eventsByType[type] = (eventsByType[type] || 0) + 1
            })
            const typeSummary = Object.entries(eventsByType)
                .map(([type, count]) => `${count} ${type}`)
                .join(", ")

            // Log success response (info level - summary)
            logger.info("[Datadog] listRumEvents - Success", {
                resultCount: formattedEvents.length,
                eventsByType,
                hasMore,
                filterDescription,
                region
            })

            // Log detailed response metadata (debug level)
            logger.debug("[Datadog] listRumEvents - Response details", {
                resultCount: formattedEvents.length,
                eventsByType,
                pagination: {
                    limit: Math.min(limit, 1000),
                    cursor: pageCursor ? "present" : "none",
                    nextCursor: nextCursor ? "present" : "none",
                    hasMore
                },
                warnings: warnings.length,
                meta: {
                    elapsed: meta?.elapsed,
                    requestId: meta?.requestId,
                    status: meta?.status
                },
                deepLink: rumLink,
                sampleResults: formattedEvents.slice(0, 3).map(event => ({
                    id: event.id,
                    type: event.type,
                    timestamp: event.timestamp,
                    service: event.service
                }))
            })

            // Return action as part of the result
            const action = {
                action: "Listed Datadog RUM events",
                integration: IntegrationType.DATADOG,
                target: "RUM events",
                details: `Found ${formattedEvents.length} RUM event${formattedEvents.length !== 1 ? "s" : ""} (${typeSummary}) with ${filterDescription}${hasMore ? " (more available)" : ""}`,
                url: rumLink,
                type: RunHistoryActionType.read,
                isReadOnly: true
            }

            return {
                success: true,
                actions: [action],
                query: query || null,
                totalEvents: formattedEvents.length,
                events: formattedEvents,
                eventsByType: eventsByType,
                rumLink,
                pagination: {
                    limit: Math.min(limit, 1000),
                    cursor: pageCursor || null,
                    nextCursor,
                    hasMore,
                    showing: `${formattedEvents.length} event${formattedEvents.length !== 1 ? "s" : ""}`
                },
                warnings: warnings.length > 0 ? warningMessages : null,
                message: `Found ${formattedEvents.length} RUM event${formattedEvents.length !== 1 ? "s" : ""} (${typeSummary}) with ${filterDescription}${hasMore ? " (more available)" : ""}. View events: ${rumLink}${warnings.length > 0 ? `\nWarnings: ${warningMessages}` : ""}`
            }
        } catch (error: any) {
            logger.error("[Datadog] listRumEvents - Error", {
                error: error.message,
                errorStatus: error.status,
                errorCode: error.code,
                requestParams: {
                    query,
                    from,
                    to,
                    limit,
                    sort,
                    pageCursor: pageCursor ? "present" : "none",
                    region
                },
                stack: error.stack
            })

            // Handle specific error cases
            if (error.status === 401 || error.status === 403) {
                throw new Error(`Datadog API authentication failed. Please verify your API key and APP key are correct and have rum_apps_read permission.`)
            } else if (error.status === 429) {
                throw new Error(`Datadog API rate limit exceeded. Please try again later.`)
            } else if (error.status === 400) {
                throw new Error(`Invalid Datadog API request: ${error.message || "Bad request"}`)
            }

            throw new Error(`Failed to list Datadog RUM events: ${error.message || "Unknown error"}`)
        }
    }
})
