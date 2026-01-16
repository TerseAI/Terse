import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { client, v2 } from "@datadog/datadog-api-client";
import logger from "../../../logger";
import { db } from "../../../prismaClient";
import { DatadogConfig } from "../../../shared/Configs";
import { getDatadogSite, getDatadogRumDeepLink } from "../../../utility/datadog";
import { IntegrationType } from "../../../shared/Integrations";
import { RunHistoryActionType } from "@prisma/client";

/**
 * Tool for querying Datadog RUM events with flexible filtering options.
 * This tool queries the Datadog RUM API v2 to find RUM events (sessions, views, actions, errors, resources, long tasks).
 * Use this to investigate frontend issues, user behavior, performance problems, or errors in the browser/mobile app.
 */
export const searchRumEventsTool = tool({
    name: 'searchRumEvents',
    description: 'Query Datadog RUM (Real User Monitoring) events with flexible filtering. Returns RUM events data (sessions, views, actions, errors, resources, long tasks) and a link to view events in Datadog. You can filter by query string (Datadog RUM search syntax), time range, or combinations. Use this when you need to investigate frontend issues, user behavior, performance problems, or browser/mobile app errors.',
    parameters: z.object({
        query: z.union([z.string(), z.null()]).optional().describe('Optional: Datadog RUM search query syntax (e.g., "@type:session AND @session.type:user", "@type:view", "@type:error", "@view.name:/dashboard"). See Datadog RUM search syntax documentation.'),
        from: z.string().describe('Start time for filtering (ISO8601 format like "2020-09-17T11:48:36+01:00" or relative like "now-15m"). Required parameter.'),
        to: z.union([z.string(), z.null()]).optional().describe('Optional: End time for filtering (ISO8601 format). If not provided, defaults to "now".'),
        limit: z.number().default(25).describe('Maximum number of RUM events to return (default: 25, max: 1000)'),
        pageCursor: z.union([z.string(), z.null()]).optional().describe('Optional: Pagination cursor from previous response to get next page of results.'),
        sort: z.enum(['timestamp', '-timestamp']).default('timestamp').describe('Sort order: "timestamp" (ascending) or "-timestamp" (descending, default).'),
        timezone: z.string().default('GMT').describe('Optional: Timezone for time-based queries (default: "GMT").'),
    }),
    execute: async ({ query, from, to = 'now', limit = 25, pageCursor, sort = 'timestamp', timezone = 'GMT' }, runContext?: RunContext<any>) => {
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

            // Build request body for RUM events search
            const requestBody: v2.RUMSearchEventsRequest = {
                filter: {
                    from: from,
                    query: query || undefined,
                    to: to || 'now',
                },
                options: {
                    timezone: timezone || 'GMT',
                },
                page: {
                    limit: Math.min(limit, 1000), // Datadog max is 1000
                    cursor: pageCursor || undefined,
                },
                sort: sort as 'timestamp' | '-timestamp',
            };

            logger.info('Querying Datadog RUM events', { 
                query, 
                from, 
                to, 
                limit, 
                cursor: pageCursor ? 'present' : 'none',
                region 
            });

            // Log full request context (debug level)
            logger.debug('[Datadog] searchRumEvents - Request details', {
                tool: 'searchRumEvents',
                integrationId: datadogConfig.integrationId,
                userId: user.id,
                requestParams: {
                    query: query || null,
                    from,
                    to: to || 'now',
                    limit: Math.min(limit, 1000),
                    sort,
                    timezone,
                    pageCursor: pageCursor ? 'present' : 'none'
                },
                region,
                site
            });

            // Call Datadog RUM API
            const response = await rumApi.searchRUMEvents({ body: requestBody });

            // Parse response
            const eventsData = response.data || [];
            const meta = response.meta;
            const links = response.links;

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
            filterDescriptions.push(`from: ${from}`);
            if (to && to !== 'now') {
                filterDescriptions.push(`to: ${to}`);
            }
            const filterDescription = filterDescriptions.join(', ');

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

            // Log success response (info level - summary)
            logger.info('[Datadog] searchRumEvents - Success', {
                resultCount: formattedEvents.length,
                eventsByType,
                hasMore,
                filterDescription,
                region
            });

            // Log detailed response metadata (debug level)
            logger.debug('[Datadog] searchRumEvents - Response details', {
                resultCount: formattedEvents.length,
                eventsByType,
                pagination: {
                    limit: Math.min(limit, 1000),
                    cursor: pageCursor ? 'present' : 'none',
                    nextCursor: nextCursor ? 'present' : 'none',
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
            });

            // Track the action
            runContext.context.trackAction({
                action: 'Searched Datadog RUM events',
                integration: IntegrationType.DATADOG,
                target: 'RUM events',
                details: `Found ${formattedEvents.length} RUM event${formattedEvents.length !== 1 ? 's' : ''} (${typeSummary}) filtered by ${filterDescription}${hasMore ? ' (more available)' : ''}`,
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
                message: `Found ${formattedEvents.length} RUM event${formattedEvents.length !== 1 ? 's' : ''} (${typeSummary}) filtered by ${filterDescription}${hasMore ? ' (more available)' : ''}. View events: ${rumLink}${warnings.length > 0 ? `\nWarnings: ${warningMessages}` : ''}`
            };
        } catch (error: any) {
            logger.error('[Datadog] searchRumEvents - Error', { 
                error: error.message,
                errorStatus: error.status,
                errorCode: error.code,
                requestParams: {
                    query, 
                    from, 
                    to,
                    limit,
                    sort,
                    timezone,
                    pageCursor: pageCursor ? 'present' : 'none',
                    region
                },
                stack: error.stack
            });
            
            // Handle specific error cases
            if (error.status === 401 || error.status === 403) {
                throw new Error(`Datadog API authentication failed. Please verify your API key and APP key are correct and have rum_apps_read permission.`);
            } else if (error.status === 429) {
                throw new Error(`Datadog API rate limit exceeded. Please try again later.`);
            } else if (error.status === 400) {
                throw new Error(`Invalid Datadog API request: ${error.message || 'Bad request'}`);
            }
            
            throw new Error(`Failed to query Datadog RUM events: ${error.message || 'Unknown error'}`);
        }
    },
});
