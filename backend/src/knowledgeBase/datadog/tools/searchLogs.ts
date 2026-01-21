import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { client, v2 } from "@datadog/datadog-api-client";
import logger from "../../../logger";
import { getDatadogSite, getDatadogLogsDeepLink } from "../../../utility/datadog";
import { IntegrationType } from "../../../shared/Integrations";
import { RunHistoryActionType } from "@prisma/client";
import { Session } from "../../../server";
import { SessionWithTracking } from "../../../agent/ChannelAgent/ChannelAgent";
import { getDatadogCredentialsByIntegrationId } from "../datadogApiClient";

/**
 * Tool for querying Datadog logs with flexible filtering options.
 * This tool queries the Datadog Logs API v2 to find logs. You can filter by query string, indexes, time range, or combinations.
 */
export const searchDatadogLogsTool = tool({
    name: 'searchDatadogLogs',
    description: 'Query Datadog logs. Filter by query string, indexes, time range. Returns logs with timestamps, status, messages, hosts, services, tags.',
    parameters: z.object({
        integrationId: z.string().describe('The integration ID of the Datadog knowledge base to use.'),
        defaultIndexes: z.union([z.array(z.string()), z.null()]).optional().describe('Default log indexes to search (e.g., ["main"]). Falls back to ["main"] if not provided.'),
        query: z.union([z.string(), z.null()]).optional().describe('Datadog log search query (e.g., service:web AND @status:error)'),
        indexes: z.union([z.array(z.string()), z.null()]).optional().describe('Log indexes to search (e.g., ["main"]). Defaults to defaultIndexes if not provided.'),
        from: z.union([z.string(), z.null()]).optional().describe('Start time (ISO8601 or relative like "now-1h")'),
        to: z.union([z.string(), z.null()]).optional().describe('End time (ISO8601). Defaults to now if not provided.'),
        limit: z.number().default(50).describe('Maximum number of log entries to return (default: 50)'),
        cursor: z.union([z.string(), z.null()]).optional().describe('Pagination cursor from previous response'),
        sort: z.enum(['timestamp', '-timestamp']).default('timestamp').describe('Sort order: "timestamp" (ascending) or "-timestamp" (descending)'),
    }),
    execute: async ({ integrationId, defaultIndexes, query, indexes, from, to, limit = 50, cursor, sort = 'timestamp' }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        const credentials = await getDatadogCredentialsByIntegrationId(integrationId, runContext.context.user.id);
        if (!credentials) {
            throw new Error(`Datadog integration not found or access denied for integrationId: ${integrationId}`);
        }

        const { apiKey, appKey, region } = credentials;
        const site = getDatadogSite(region);

        // Use indexes parameter if provided, otherwise use defaultIndexes, otherwise fallback to ["main"]
        const indexesToUse = indexes && indexes.length > 0 
            ? indexes 
            : (defaultIndexes && defaultIndexes.length > 0 
                ? defaultIndexes 
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
                integrationId,
                userId: runContext.context.user.id,
                requestParams: {
                    query: query || null,
                    indexes: indexesToUse,
                    providedIndexes: indexes,
                    defaultIndexes: defaultIndexes,
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
