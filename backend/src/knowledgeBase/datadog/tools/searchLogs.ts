import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { client, v2 } from "@datadog/datadog-api-client";
import logger from "../../../logger";
import { db } from "../../../prismaClient";
import { DatadogConfig } from "../../../shared/Configs";
import { getDatadogSite, getDatadogLogsDeepLink } from "../../../utility/datadog";
import { IntegrationType } from "../../../shared/Integrations";
import { RunHistoryActionType } from "@prisma/client";

/**
 * Tool for querying Datadog logs with flexible filtering options.
 * This tool queries the Datadog Logs API v2 to find logs. You can filter by query string, indexes, time range, or combinations.
 */
export const searchDatadogLogsTool = tool({
    name: 'searchDatadogLogs',
    description: 'Query Datadog logs with flexible filtering. Returns logs data and a link to view logs in Datadog. You can filter by query string (Datadog log search syntax), indexes, time range, or combinations. Use this when you need to investigate errors, events, or search logs in Datadog.',
    parameters: z.object({
        query: z.union([z.string(), z.null()]).optional().describe('Optional: Datadog log search query syntax (e.g., "host:Test*", "service:web AND @status:error"). See Datadog log search syntax documentation.'),
        indexes: z.union([z.array(z.string()), z.null()]).optional().describe('Optional: Array of log indexes to search (e.g., ["main", "custom-index"]). If not provided, uses default indexes from configuration.'),
        from: z.union([z.string(), z.null()]).optional().describe('Optional: Start time for filtering (ISO8601 format like "2020-09-17T11:48:36+01:00" or relative like "now-1h"). If not provided, no start time restriction is applied.'),
        to: z.union([z.string(), z.null()]).optional().describe('Optional: End time for filtering (ISO8601 format). If not provided, defaults to current time.'),
        limit: z.number().default(50).describe('Maximum number of log entries to return (default: 50)'),
        cursor: z.union([z.string(), z.null()]).optional().describe('Optional: Pagination cursor from previous response to get next page of results.'),
        sort: z.enum(['timestamp', '-timestamp']).default('timestamp').describe('Sort order: "timestamp" (ascending, default) or "-timestamp" (descending).'),
    }),
    execute: async ({ query, indexes, from, to, limit = 50, cursor, sort = 'timestamp' }, runContext?: RunContext<any>) => {
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

        // Use default indexes from config if not provided
        const indexesToUse = indexes && indexes.length > 0 
            ? indexes 
            : (datadogConfig.defaultIndexes && datadogConfig.defaultIndexes.length > 0 
                ? datadogConfig.defaultIndexes 
                : ["main"]);

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

            const logsApi = new v2.LogsApi(configuration);

            // Build request body
            const requestBody: v2.LogsListRequest = {
                filter: {
                    query: query || undefined,
                    indexes: indexesToUse,
                    from: from || undefined,
                    to: to || undefined,
                },
                sort: sort as 'timestamp' | '-timestamp',
                page: {
                    limit: Math.min(limit, 1000), // Datadog max is 1000
                    cursor: cursor || undefined,
                },
            };

            logger.info('Querying Datadog logs', { 
                query, 
                indexes: indexesToUse, 
                from, 
                to, 
                limit, 
                cursor: cursor ? 'present' : 'none',
                region 
            });

            // Log full request context (debug level)
            logger.debug('[Datadog] searchDatadogLogs - Request details', {
                tool: 'searchDatadogLogs',
                integrationId: datadogConfig.integrationId,
                userId: user.id,
                requestParams: {
                    query: query || null,
                    indexes: indexesToUse,
                    providedIndexes: indexes,
                    defaultIndexes: datadogConfig.defaultIndexes,
                    from,
                    to,
                    limit: Math.min(limit, 1000),
                    sort,
                    cursor: cursor ? 'present' : 'none'
                },
                region,
                site
            });

            // Call Datadog API
            const response = await logsApi.listLogs({ body: requestBody });

            // Parse response
            const logsData = response.data || [];
            const meta = response.meta;
            const links = response.links;

            // Format log entries
            const formattedLogs = logsData.map((log: any) => {
                const attrs = log.attributes || {};
                return {
                    id: log.id,
                    timestamp: attrs.timestamp,
                    message: attrs.message,
                    host: attrs.host,
                    service: attrs.service,
                    status: attrs.status,
                    tags: attrs.tags || [],
                    customAttributes: attrs.attributes || {},
                };
            });

            // Build deep link to Datadog logs UI with query parameters
            // If time window is not provided, default to last hour for a useful link
            const linkFrom = from || 'now-1h';
            const linkTo = to || 'now';
            const logsLink = getDatadogLogsDeepLink(region, query, linkFrom, linkTo);

            // Determine if there are more results available
            const nextCursor = meta?.page?.after || null;
            const hasMore = !!nextCursor;

            // Build filter description for the response message
            const filterDescriptions: string[] = [];
            if (query) {
                filterDescriptions.push(`query="${query}"`);
            }
            if (indexesToUse && indexesToUse.length > 0) {
                filterDescriptions.push(`indexes: ${indexesToUse.join(', ')}`);
            }
            if (from) {
                filterDescriptions.push(`from: ${from}`);
            }
            if (to) {
                filterDescriptions.push(`to: ${to}`);
            }
            const filterDescription = filterDescriptions.length > 0 
                ? filterDescriptions.join(', ') 
                : 'no filters';

            // Include warnings if present
            const warnings = meta?.warnings || [];
            const warningMessages = warnings.map((w: any) => `${w.title}: ${w.detail}`).join('; ');

            // Log success response (info level - summary)
            logger.info('[Datadog] searchDatadogLogs - Success', {
                resultCount: formattedLogs.length,
                hasMore,
                filterDescription,
                region
            });

            // Log detailed response metadata (debug level)
            logger.debug('[Datadog] searchDatadogLogs - Response details', {
                resultCount: formattedLogs.length,
                pagination: {
                    limit: Math.min(limit, 1000),
                    cursor: cursor ? 'present' : 'none',
                    nextCursor: nextCursor ? 'present' : 'none',
                    hasMore
                },
                warnings: warnings.length,
                meta: {
                    elapsed: meta?.elapsed,
                    requestId: meta?.requestId,
                    status: meta?.status
                },
                deepLink: logsLink,
                sampleResults: formattedLogs.slice(0, 3).map(log => ({
                    id: log.id,
                    timestamp: log.timestamp,
                    service: log.service,
                    status: log.status,
                    host: log.host
                }))
            });

            // Track the action
            runContext.context.trackAction({
                action: 'Searched Datadog logs',
                integration: IntegrationType.DATADOG,
                target: indexesToUse.length > 0 ? `Datadog logs (indexes: ${indexesToUse.join(', ')})` : 'Datadog logs',
                details: `Found ${formattedLogs.length} log entry${formattedLogs.length !== 1 ? 's' : ''} with ${filterDescription}${hasMore ? ' (more available)' : ''}`,
                url: logsLink,
                type: RunHistoryActionType.read,
                isReadOnly: true,
            });

            return {
                success: true,
                query: query || null,
                indexes: indexesToUse,
                totalLogs: formattedLogs.length,
                logs: formattedLogs,
                logsLink,
                pagination: {
                    limit: Math.min(limit, 1000),
                    cursor: cursor || null,
                    nextCursor,
                    hasMore,
                    showing: `${formattedLogs.length} log${formattedLogs.length !== 1 ? 's' : ''}`,
                },
                warnings: warnings.length > 0 ? warningMessages : null,
                message: `Found ${formattedLogs.length} log entries filtered by ${filterDescription}${hasMore ? ' (more available)' : ''}. View logs: ${logsLink}${warnings.length > 0 ? `\nWarnings: ${warningMessages}` : ''}`
            };
        } catch (error: any) {
            logger.error('[Datadog] searchDatadogLogs - Error', { 
                error: error.message,
                errorStatus: error.status,
                errorCode: error.code,
                requestParams: {
                    query, 
                    indexes: indexesToUse, 
                    from, 
                    to,
                    limit,
                    sort,
                    cursor: cursor ? 'present' : 'none',
                    region
                },
                stack: error.stack
            });
            
            // Handle specific error cases
            if (error.status === 401 || error.status === 403) {
                throw new Error(`Datadog API authentication failed. Please verify your API key and APP key are correct.`);
            } else if (error.status === 429) {
                throw new Error(`Datadog API rate limit exceeded. Please try again later.`);
            } else if (error.status === 400) {
                throw new Error(`Invalid Datadog API request: ${error.message || 'Bad request'}`);
            }
            
            throw new Error(`Failed to query Datadog logs: ${error.message || 'Unknown error'}`);
        }
    },
});
