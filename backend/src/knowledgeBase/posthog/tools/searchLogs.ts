import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import logger from "../../../logger";
import { IntegrationType } from "../../../shared/Integrations";
import { RunHistoryActionType } from "@prisma/client";
import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner";
import { Session } from "../../../server";
import { getPosthogApiKeyByIntegrationId } from "../posthogApiClient";
import { ToolName } from "../../../tools/ToolNames";

/**
 * Tool for querying PostHog logs with flexible filtering options.
 * This tool queries the PostHog Logs product API to find logs. You can filter by user, log level, message content, or combinations thereof.
 */
export const searchLogsTool = tool({
    name: ToolName.POSTHOG_SEARCH_LOGS,
    description: 'Query PostHog logs with flexible filtering. Returns logs data and a link to view logs in PostHog. You can filter by user email, log severity levels (error, warn, info, debug), message text search, or combinations. At least one filter (user email, severity levels, or message search) should be provided to avoid overly broad queries. Use this when you need to investigate user activity, errors, or events in PostHog logs.',
    parameters: z.object({
        integrationId: z.string().describe('The integration ID of the PostHog knowledge base to use.'),
        projectId: z.string().describe('The PostHog project ID.'),
        canReadLogs: z.boolean().default(false).describe('Whether logs access is enabled for this knowledge base.'),
        userEmail: z.union([z.string(), z.null()]).optional().describe('Optional: User email to filter logs by (e.g., "user@example.com").'),
        severityLevels: z.union([z.array(z.enum(['error', 'warn', 'info', 'debug'])), z.null()]).describe('Optional: Array of log severity levels to filter by (e.g., ["error", "warn"]). If not provided, all severity levels are included.'),
        messageSearch: z.union([z.string(), z.null()]).describe('Optional: Text to search for within log messages. Searches are case-insensitive and match partial text.'),
        limit: z.number().default(50).describe('Maximum number of log entries to return (default: 50, max: 250)'),
        offset: z.number().default(0).describe('Offset for pagination (default: 0). Use with limit to page through results. For example, offset=0 gets logs 1-50, offset=50 gets logs 51-100, etc.'),
        last7Days: z.boolean().default(false).describe('If true and dateFrom is not provided, filters logs from the last 7 days only (default: false). If false, no date restriction is applied unless dateFrom is explicitly provided.'),
        dateFrom: z.union([z.string(), z.null()]).describe('Start date for filtering (ISO format or relative like "-7d"). If not provided and last7Days is true, defaults to 7 days ago. If not provided and last7Days is false, no date restriction is applied.'),
        dateTo: z.union([z.string(), z.null()]).describe('End date for filtering (ISO format or relative like "now"). If not provided, defaults to now.'),
    }),
    execute: async ({ integrationId, projectId, canReadLogs, userEmail, severityLevels, messageSearch, limit = 50, offset = 0, last7Days = false, dateFrom, dateTo }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        if (canReadLogs !== true) {
            throw new Error("PostHog logs access is not enabled for this knowledge base.");
        }

        // Normalize null to undefined for easier handling
        const normalizedUserEmail = userEmail ?? undefined;
        const normalizedSeverityLevels = severityLevels ?? undefined;
        const normalizedMessageSearch = messageSearch ?? undefined;

        // Validate that at least one filter is provided
        const hasUserFilter = normalizedUserEmail && normalizedUserEmail.trim().length > 0;
        const hasSeverityFilter = normalizedSeverityLevels && normalizedSeverityLevels.length > 0;
        const hasMessageFilter = normalizedMessageSearch && normalizedMessageSearch.trim().length > 0;

        if (!hasUserFilter && !hasSeverityFilter && !hasMessageFilter) {
            throw new Error("At least one filter must be provided: userEmail, severityLevels, or messageSearch.");
        }

        const posthogApiKey = await getPosthogApiKeyByIntegrationId(integrationId, runContext.context.user.id);
        if (!posthogApiKey) {
            throw new Error(`PostHog integration not found or access denied for integrationId: ${integrationId}`);
        }

        const posthogHost = 'https://us.posthog.com';

        try {
            // Calculate date filters - use PostHog relative format
            let dateFromValue: string | null = dateFrom ?? null;
            
            // Default to last 7 days if last7Days is true and dateFrom is not provided
            if (last7Days && !dateFromValue) {
                dateFromValue = '-7d';
            }

            logger.info('Querying PostHog logs', { userEmail: normalizedUserEmail, severityLevels: normalizedSeverityLevels, messageSearch: normalizedMessageSearch, projectId, limit, offset, dateFrom: dateFromValue });

            // Query the Logs product API
            const logsQueryUrl = `${posthogHost}/api/projects/${projectId}/logs/query/`;
            
            // Build filterGroup conditionally - all filters go into a single inner values array
            const filterConditions: any[] = [];
            if (hasUserFilter && normalizedUserEmail) {
                filterConditions.push({
                    key: 'userEmail',
                    value: [normalizedUserEmail],
                    operator: 'exact',
                    type: 'log_attribute',
                });
            }
            if (hasMessageFilter && normalizedMessageSearch) {
                filterConditions.push({
                    key: 'message',
                    value: normalizedMessageSearch.trim(),
                    operator: 'icontains',
                    type: 'log',
                });
            }

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
                    searchTerm: '', // Not used - message filtering is done via filterGroup
                    filterGroup: filterConditions.length > 0 ? {
                        type: 'AND',
                        values: [
                            {
                                type: 'AND',
                                values: filterConditions,
                            },
                        ],
                    } : undefined,
                    severityLevels: normalizedSeverityLevels && normalizedSeverityLevels.length > 0 ? normalizedSeverityLevels : [],
                    serviceNames: [],
                },
            };
            
            const fetchResponse = await fetch(logsQueryUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${posthogApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!fetchResponse.ok) {
                const errorText = await fetchResponse.text();
                logger.error('PostHog logs API error', {
                    status: fetchResponse.status,
                    error: errorText,
                    userEmail: normalizedUserEmail,
                    severityLevels: normalizedSeverityLevels,
                    messageSearch: normalizedMessageSearch,
                    projectId
                });
                
                if (fetchResponse.status === 401) {
                    throw new Error('PostHog API key is invalid or expired. Please update your PostHog integration.');
                } else if (fetchResponse.status === 403) {
                    throw new Error('PostHog API key does not have logs:read permission. Please ensure your API key has the correct scope.');
                } else if (fetchResponse.status === 404) {
                    throw new Error(`PostHog project ${projectId} not found. Please verify the project ID in your configuration.`);
                }
                
                throw new Error(`Failed to query PostHog logs: ${errorText}`);
            }

            const logsData = await fetchResponse.json();
            
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
                level: log.level || log.severity || log.severity_text || 'info',
                message: log.body || log.message || log.content || log.text || '',
                service: log.service || log.service_name || log.source || log.resource_attributes?.['service.name'] || 'unknown',
                attributes: log.attributes || log.properties || {},
            }));

            // Determine if there are more results available
            const hasMore = formattedLogs.length === Math.min(limit, 250);
            const nextOffset = hasMore ? offset + formattedLogs.length : null;

            // Build filter description for the response message
            const filterDescriptions: string[] = [];
            if (hasUserFilter && normalizedUserEmail) {
                filterDescriptions.push(`userEmail="${normalizedUserEmail}"`);
            }
            if (hasSeverityFilter && normalizedSeverityLevels) {
                filterDescriptions.push(`severity levels: ${normalizedSeverityLevels.join(', ')}`);
            }
            if (hasMessageFilter && normalizedMessageSearch) {
                filterDescriptions.push(`message contains: "${normalizedMessageSearch}"`);
            }
            const filterDescription = filterDescriptions.length > 0 
                ? filterDescriptions.join(', ') 
                : 'no filters';

            const response = {
                success: true,
                userEmail: normalizedUserEmail || null,
                severityLevels: normalizedSeverityLevels || null,
                messageSearch: normalizedMessageSearch || null,
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
                message: `Found ${formattedLogs.length} log entries filtered by ${filterDescription} (showing ${offset + 1}-${offset + formattedLogs.length}${hasMore ? ', more available' : ''}). View all logs: ${logsLink}`
            };

            // Return action as part of the result
            const queryDesc = normalizedMessageSearch ? ` matching "${normalizedMessageSearch}"` : '';
            const action = {
                action: 'Searched PostHog logs',
                integration: IntegrationType.POSTHOG,
                target: projectId,
                details: `Searched event logs: Found ${formattedLogs.length} event(s)${queryDesc}${dateFromValue ? ` from ${dateFromValue}` : ''}${dateTo ? ` to ${dateTo}` : ''}`,
                url: logsLink,
                type: RunHistoryActionType.read,
                isReadOnly: true,
            };

            return {
                ...response,
                actions: [action],
            };
        } catch (error: any) {
            logger.error('Error querying PostHog logs', { error, userEmail: normalizedUserEmail, severityLevels: normalizedSeverityLevels, messageSearch: normalizedMessageSearch, projectId });
            throw new Error(`Failed to query PostHog logs: ${error.message || 'Unknown error'}`);
        }
    },
});

