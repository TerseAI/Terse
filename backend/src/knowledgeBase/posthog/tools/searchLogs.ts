import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import logger from "../../../logger";
import { db } from "../../../prismaClient";
import { PosthogConfig } from "../../../shared/Configs";

/**
 * Tool for querying PostHog logs for a specific user.
 * This tool queries the PostHog Logs product API to find logs associated with a user.
 */
export const searchLogsTool = tool({
    name: 'searchPosthogLogs',
    description: 'Query PostHog logs for a specific user. Returns logs data and a link to view logs in PostHog. Use this when you need to investigate user activity, errors, or events in PostHog logs. The logs can be filtered by user email or user ID depending on how logs are instrumented.',
    parameters: z.object({
        filterValue: z.string().describe('The value to filter logs by (e.g., user email like "user@example.com" or user ID like "cmgv175dh06doks21hj06m2gt").'),
        filterKey: z.enum(['userEmail', 'userId']).default('userEmail').describe('The PostHog log attribute key to filter on. Use "userEmail" if logs have a userEmail attribute, or "userId" if logs have a userId attribute. Default: "userEmail".'),
        limit: z.number().default(50).describe('Maximum number of log entries to return (default: 50, max: 250)'),
        offset: z.number().default(0).describe('Offset for pagination (default: 0). Use with limit to page through results. For example, offset=0 gets logs 1-50, offset=50 gets logs 51-100, etc.'),
        last7Days: z.boolean().default(false).describe('If true and dateFrom is not provided, filters logs from the last 7 days only (default: false). If false, no date restriction is applied unless dateFrom is explicitly provided.'),
        dateFrom: z.union([z.string(), z.null()]).describe('Start date for filtering (ISO format or relative like "-7d"). If not provided and last7Days is true, defaults to 7 days ago. If not provided and last7Days is false, no date restriction is applied.'),
        dateTo: z.union([z.string(), z.null()]).describe('End date for filtering (ISO format or relative like "now"). If not provided, defaults to now.'),
    }),
    execute: async ({ filterValue, filterKey = 'userEmail', limit = 50, offset = 0, last7Days = false, dateFrom, dateTo }, runContext?: RunContext<any>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        // Get PostHog config from context - must be set by the knowledge base session
        const posthogConfig = runContext.context.posthogConfig as PosthogConfig | undefined;
        if (!posthogConfig) {
            throw new Error("PostHog config not found in context. Ensure PostHog is configured as a knowledge base.");
        }

        if (!posthogConfig.canReadLogs) {
            throw new Error("PostHog logs access is not enabled for this knowledge base.");
        }

        const user = runContext.context.user;
        if (!user) {
            throw new Error("User not found in context");
        }

        // Get PostHog integration
        const integration = await db().posthog_integrations.findUnique({
            where: { id: posthogConfig.integrationId },
        });

        if (!integration) {
            throw new Error(`PostHog integration not found: ${posthogConfig.integrationId}`);
        }

        const posthogApiKey = integration.api_key;
        const projectId = posthogConfig.projectId;
        const posthogHost = 'https://us.posthog.com';

        try {
            // Calculate date filters - use PostHog relative format
            let dateFromValue: string | null = dateFrom ?? null;
            
            // Default to last 7 days if last7Days is true and dateFrom is not provided
            if (last7Days && !dateFromValue) {
                dateFromValue = '-7d';
            }

            logger.info('Querying PostHog logs', { filterValue, filterKey, projectId, limit, offset, dateFrom: dateFromValue });

            // Query the Logs product API
            const logsQueryUrl = `${posthogHost}/api/projects/${projectId}/logs/query/`;
            
            // Build the request body in the correct PostHog Logs API format
            const requestBody = {
                query: {
                    limit: Math.min(limit, 250), // PostHog max is 250
                    offset: offset,
                    orderBy: 'latest',
                    dateRange: {
                        date_from: dateFromValue,
                        date_to: dateTo ?? null,
                    },
                    searchTerm: '',
                    filterGroup: {
                        type: 'AND',
                        values: [
                            {
                                type: 'AND',
                                values: [
                                    {
                                        key: filterKey,
                                        value: [filterValue],
                                        operator: 'exact',
                                        type: 'log_attribute',
                                    },
                                ],
                            },
                        ],
                    },
                    severityLevels: [],
                    serviceNames: [],
                },
            };
            
            const response = await fetch(logsQueryUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${posthogApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error('PostHog logs API error', {
                    status: response.status,
                    error: errorText,
                    filterKey,
                    filterValue,
                    projectId
                });
                
                if (response.status === 401) {
                    throw new Error('PostHog API key is invalid or expired. Please update your PostHog integration.');
                } else if (response.status === 403) {
                    throw new Error('PostHog API key does not have logs:read permission. Please ensure your API key has the correct scope.');
                } else if (response.status === 404) {
                    throw new Error(`PostHog project ${projectId} not found. Please verify the project ID in your configuration.`);
                }
                
                throw new Error(`Failed to query PostHog logs: ${errorText}`);
            }

            const logsData = await response.json();
            
            // Build link to logs UI
            const logsLink = `${posthogHost}/project/${projectId}/logs`;

            // Extract and format log entries
            const logEntries = Array.isArray(logsData) 
                ? logsData 
                : (logsData.results || logsData.data || logsData.logs || []);

            // Get pagination metadata if available
            const totalCount = logsData.count || logsData.total || logEntries.length;

            // Sort by timestamp descending (latest first) if not already sorted
            const sortedLogs = [...logEntries].sort((a: any, b: any) => {
                const timeA = new Date(a.timestamp || a.created_at || a.time || 0).getTime();
                const timeB = new Date(b.timestamp || b.created_at || b.time || 0).getTime();
                return timeB - timeA; // Descending order
            });

            const formattedLogs = sortedLogs.map((log: any) => ({
                id: log.id || log.log_id || log.uuid,
                timestamp: log.timestamp || log.created_at || log.time,
                level: log.level || log.severity || 'info',
                message: log.message || log.content || log.text || '',
                service: log.service || log.service_name || log.source,
                attributes: log.attributes || log.properties || {},
            }));

            // Determine if there are more results available
            const hasMore = formattedLogs.length === Math.min(limit, 250);
            const nextOffset = hasMore ? offset + formattedLogs.length : null;

            return {
                success: true,
                filterKey,
                filterValue,
                projectId,
                totalLogs: totalCount,
                logs: formattedLogs,
                logsLink,
                pagination: {
                    limit: Math.min(limit, 250),
                    offset,
                    hasMore,
                    nextOffset,
                    showing: `${offset + 1}-${offset + formattedLogs.length}`,
                },
                message: `Found ${formattedLogs.length} log entries for ${filterKey}="${filterValue}" (showing ${offset + 1}-${offset + formattedLogs.length}${hasMore ? ', more available' : ''}). View all logs: ${logsLink}`
            };
        } catch (error: any) {
            logger.error('Error querying PostHog logs', { error, filterKey, filterValue, projectId });
            throw new Error(`Failed to query PostHog logs: ${error.message || 'Unknown error'}`);
        }
    },
});

