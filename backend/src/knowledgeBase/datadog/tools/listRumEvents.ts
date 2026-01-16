import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { client, v2 } from "@datadog/datadog-api-client";
import logger from "../../../logger";
import { db } from "../../../prismaClient";
import { DatadogConfig } from "../../../shared/Configs";
import { getDatadogSite, getDatadogRumDeepLink, parseDatadogTimeString } from "../../../utility/datadog";
import { IntegrationType } from "../../../shared/Integrations";
import { RunHistoryActionType } from "@prisma/client";

/**
 * Tool for listing Datadog RUM events using the simple GET endpoint.
 * This tool queries the Datadog RUM API v2 GET endpoint to retrieve recent RUM events.
 * Use this to discover what RUM events exist, especially when it's ambiguous what you should be querying on.
 * Great for exploration before crafting specific search queries.
 */
export const listRumEventsTool = tool({
    name: 'listRumEvents',
    description: 'List Datadog RUM (Real User Monitoring) events using the simple GET endpoint. Returns recent RUM events data (sessions, views, actions, errors, resources, long tasks). Use this to discover what RUM events exist, especially when it\'s ambiguous what you should be querying on. Great for exploration before crafting specific search queries. This is simpler than searchRumEvents and is optimized for quick access to recent events.',
    parameters: z.object({
        query: z.union([z.string(), z.null()]).optional().describe('Optional: Datadog RUM search query syntax to filter events (e.g., "@type:session AND @session.type:user", "@type:view"). Can be omitted to get recent events without filtering.'),
        from: z.union([z.string(), z.null()]).optional().describe('Optional: Minimum timestamp for filtering (ISO8601 format only, e.g., "2020-09-17T11:48:36+01:00"). If not provided, retrieves recent events.'),
        to: z.union([z.string(), z.null()]).optional().describe('Optional: Maximum timestamp for filtering (ISO8601 format only, e.g., "2020-09-17T11:48:36+01:00"). If not provided, defaults to current time.'),
        limit: z.number().default(25).describe('Maximum number of RUM events to return (default: 25, max: 1000)'),
        pageCursor: z.union([z.string(), z.null()]).optional().describe('Optional: Pagination cursor from previous response to get next page of results.'),
        sort: z.enum(['timestamp', '-timestamp']).default('timestamp').describe('Sort order: "timestamp" (ascending) or "-timestamp" (descending, default).'),
    }),
    execute: async ({ query, from, to, limit = 25, pageCursor, sort = 'timestamp' }, runContext?: RunContext<any>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        // Get Datadog config from context - must be set by the knowledge base session
        const datadogConfig = runContext.context.datadogConfig as DatadogConfig | undefined;
        if (!datadogConfig) {
            throw new Error("Datadog config not found in context. Ensure Datadog is configured as a knowledge base.");
        }

        const user = runContext.context.user;
        if (!user) {
            throw new Error("User not found in context");
        }

        // Get Datadog integration
        const integration = await db().datadog_integrations.findUnique({
            where: { id: datadogConfig.integrationId },
        });

        if (!integration) {
            throw new Error(`Datadog integration not found: ${datadogConfig.integrationId}`);
        }

        const apiKey = integration.api_key;
        const appKey = integration.app_key;
        const region = integration.region;
        const site = getDatadogSite(region);

        try {
            // Configure Datadog client
            const configuration = client.createConfiguration({
                authMethods: {
                    apiKeyAuth: apiKey,
                    appKeyAuth: appKey,
                },
            });
            configuration.setServerVariables({
                site: site,
            });

            const rumApi = new v2.RUMApi(configuration);

            // Build request parameters for GET endpoint (query string format)
            // Only ISO8601 date strings are supported (not relative time formats like "now-15m")
            const params: v2.RUMApiListRUMEventsRequest = {
                filterQuery: query || undefined,
                filterFrom: from ? parseDatadogTimeString(from) : undefined,
                filterTo: to ? parseDatadogTimeString(to) : undefined,
                sort: sort as 'timestamp' | '-timestamp',
                pageCursor: pageCursor || undefined,
                pageLimit: Math.min(limit, 1000), // Datadog max is 1000
            };

            logger.info('Listing Datadog RUM events', { 
                query, 
                from, 
                to, 
                limit, 
                cursor: pageCursor ? 'present' : 'none',
                region 
            });

            // Call Datadog RUM API GET endpoint
            const response = await rumApi.listRUMEvents(params);

            // Parse response
            const eventsData = response.data || [];
            const meta = response.meta;

            // Format RUM event entries - RUM events have different structures based on type
            const formattedEvents = eventsData.map((event: any) => {
                const attrs = event.attributes || {};
                const eventType = attrs.type || 'unknown';
                
                // Base event structure
                const formatted: any = {
                    id: event.id,
                    type: eventType,
                    timestamp: attrs.date || attrs.timestamp,
                };

                // Add type-specific attributes
                if (eventType === 'session') {
                    formatted.session = {
                        id: attrs.session?.id,
                        type: attrs.session?.type,
                        hasReplay: attrs.session?.has_replay,
                        duration: attrs.session?.duration,
                    };
                } else if (eventType === 'view') {
                    formatted.view = {
                        id: attrs.view?.id,
                        name: attrs.view?.name,
                        url: attrs.view?.url,
                        loadTime: attrs.view?.loading_time,
                        timeSpent: attrs.view?.time_spent,
                    };
                } else if (eventType === 'action') {
                    formatted.action = {
                        id: attrs.action?.id,
                        type: attrs.action?.type,
                        target: attrs.action?.target,
                        loadingTime: attrs.action?.loading_time,
                    };
                } else if (eventType === 'error') {
                    formatted.error = {
                        id: attrs.error?.id,
                        message: attrs.error?.message,
                        source: attrs.error?.source,
                        stack: attrs.error?.stack,
                        type: attrs.error?.type,
                    };
                } else if (eventType === 'resource') {
                    formatted.resource = {
                        id: attrs.resource?.id,
                        type: attrs.resource?.type,
                        url: attrs.resource?.url,
                        method: attrs.resource?.method,
                        statusCode: attrs.resource?.status_code,
                        duration: attrs.resource?.duration,
                    };
                } else if (eventType === 'long_task') {
                    formatted.longTask = {
                        id: attrs.long_task?.id,
                        duration: attrs.long_task?.duration,
                    };
                }

                // Add common attributes
                formatted.service = attrs.service;
                formatted.version = attrs.version;
                formatted.environment = attrs.env;
                formatted.device = attrs.device;
                formatted.os = attrs.os;
                formatted.browser = attrs.browser;
                formatted.user = attrs.user;
                formatted.view = formatted.view || attrs.view; // Fallback if view exists but not in view type
                formatted.tags = attrs.tags || [];
                formatted.customAttributes = attrs.attributes || {};

                return formatted;
            });

            // Build deep link to Datadog RUM UI with query parameters
            const rumLink = getDatadogRumDeepLink(region, query, from, to);

            // Determine if there are more results available
            const nextCursor = meta?.page?.after || null;
            const hasMore = !!nextCursor;

            // Build filter description for the response message
            const filterDescriptions: string[] = [];
            if (query) {
                filterDescriptions.push(`query="${query}"`);
            }
            if (from) {
                filterDescriptions.push(`from: ${from}`);
            }
            if (to) {
                filterDescriptions.push(`to: ${to}`);
            }
            const filterDescription = filterDescriptions.length > 0 
                ? filterDescriptions.join(', ') 
                : 'no filters (recent events)';

            // Include warnings if present
            const warnings = meta?.warnings || [];
            const warningMessages = warnings.map((w: any) => `${w.title}: ${w.detail}`).join('; ');

            // Count events by type for summary
            const eventsByType: Record<string, number> = {};
            formattedEvents.forEach((event: any) => {
                const type = event.type || 'unknown';
                eventsByType[type] = (eventsByType[type] || 0) + 1;
            });
            const typeSummary = Object.entries(eventsByType)
                .map(([type, count]) => `${count} ${type}`)
                .join(', ');

            // Track the action
            runContext.context.trackAction({
                action: 'Listed Datadog RUM events',
                integration: IntegrationType.DATADOG,
                target: 'RUM events',
                details: `Found ${formattedEvents.length} RUM event${formattedEvents.length !== 1 ? 's' : ''} (${typeSummary}) with ${filterDescription}${hasMore ? ' (more available)' : ''}`,
                url: rumLink,
                type: RunHistoryActionType.read,
                isReadOnly: true,
            });

            return {
                success: true,
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
                    showing: `${formattedEvents.length} event${formattedEvents.length !== 1 ? 's' : ''}`,
                },
                warnings: warnings.length > 0 ? warningMessages : null,
                message: `Found ${formattedEvents.length} RUM event${formattedEvents.length !== 1 ? 's' : ''} (${typeSummary}) with ${filterDescription}${hasMore ? ' (more available)' : ''}. View events: ${rumLink}${warnings.length > 0 ? `\nWarnings: ${warningMessages}` : ''}`
            };
        } catch (error: any) {
            logger.error('Error listing Datadog RUM events', { 
                error, 
                query, 
                from, 
                to, 
                region 
            });
            
            // Handle specific error cases
            if (error.status === 401 || error.status === 403) {
                throw new Error(`Datadog API authentication failed. Please verify your API key and APP key are correct and have rum_apps_read permission.`);
            } else if (error.status === 429) {
                throw new Error(`Datadog API rate limit exceeded. Please try again later.`);
            } else if (error.status === 400) {
                throw new Error(`Invalid Datadog API request: ${error.message || 'Bad request'}`);
            }
            
            throw new Error(`Failed to list Datadog RUM events: ${error.message || 'Unknown error'}`);
        }
    },
});
