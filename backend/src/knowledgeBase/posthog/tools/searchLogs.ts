import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import logger from "../../../logger";
import { db } from "../../../prismaClient";
import { PosthogConfig } from "../../../shared/Configs";

/**
 * Tool for querying PostHog logs for a specific user.
 * This tool queries the PostHog Logs product API to find logs associated with a user's email.
 */
export const searchLogsTool = tool({
    name: 'searchPosthogLogs',
    description: 'Query PostHog logs for a specific user by their email address. Returns logs data and a link to view logs in PostHog. Use this when you need to investigate user activity, errors, or events in PostHog logs.',
    parameters: z.object({
        userEmail: z.string().email().describe('The email address of the user to query logs for. Must be a valid email address.'),
        limit: z.number().default(50).describe('Maximum number of log entries to return (default: 50, max: 100)'),
        offset: z.number().default(0).describe('Offset for pagination (default: 0)'),
        last7Days: z.boolean().default(false).describe('Filter logs from the last 7 days only (default: false)'),
        dateFrom: z.union([z.string(), z.null()]).describe('Start date for filtering (ISO format or relative like "-7d"). If not provided and last7Days is true, defaults to 7 days ago.'),
        dateTo: z.union([z.string(), z.null()]).describe('End date for filtering (ISO format or relative like "now"). If not provided, defaults to now.'),
    }),
    execute: async ({ userEmail, limit = 50, offset = 0, last7Days = false, dateFrom, dateTo }, runContext?: RunContext<any>) => {
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
            // Calculate date filters - default to last 7 days if not provided
            let dateFromValue = dateFrom ?? undefined;
            let dateToValue = dateTo ?? undefined;
            
            // Default to last 7 days if dateFrom is not provided
            if (!dateFromValue) {
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                dateFromValue = sevenDaysAgo.toISOString();
            }
            
            // Default to now if dateTo is not provided
            if (!dateToValue) {
                dateToValue = new Date().toISOString();
            }

            logger.info('Querying PostHog logs', { userEmail, projectId, limit, offset, dateFrom: dateFromValue, dateTo: dateToValue });

            // Query the Logs product API
            const logsQueryUrl = `${posthogHost}/api/projects/${projectId}/logs/query/`;
            
            const requestBody: any = {
                query: '', // PostHog logs API requires a query parameter (can be empty when using filters)
                filters: {
                    person: {
                        email: userEmail
                    }
                },
                limit: Math.min(limit, 100), // Cap at 100
                offset: offset,
            };

            // Add date filters if provided
            if (dateFromValue) {
                requestBody.date_from = dateFromValue;
            }
            if (dateToValue) {
                requestBody.date_to = dateToValue;
            }

            // Note: PostHog API doesn't support order_by in request body, so we'll sort client-side
            
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
                    userEmail,
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
            
            // Build link to logs UI (filtered by user if possible)
            const logsLink = `${posthogHost}/logs?person_email=${encodeURIComponent(userEmail)}`;

            // Extract and format log entries
            const logEntries = Array.isArray(logsData) 
                ? logsData 
                : (logsData.results || logsData.data || logsData.logs || []);

            // Get pagination metadata if available
            const totalCount = logsData.count || logsData.total || logEntries.length;
            const hasNext = logsData.next ? true : false;
            const hasPrevious = logsData.previous ? true : false;

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

            return {
                success: true,
                userEmail,
                projectId,
                totalLogs: totalCount,
                logs: formattedLogs,
                logsLink,
                pagination: {
                    limit,
                    offset,
                    hasNext,
                    hasPrevious,
                    nextOffset: hasNext ? offset + limit : null,
                    previousOffset: hasPrevious ? Math.max(0, offset - limit) : null,
                },
                message: `Found ${formattedLogs.length} log entries for ${userEmail} (showing ${offset + 1}-${offset + formattedLogs.length} of ${totalCount}). View all logs: ${logsLink}`
            };
        } catch (error: any) {
            logger.error('Error querying PostHog logs', { error, userEmail, projectId });
            throw new Error(`Failed to query PostHog logs: ${error.message || 'Unknown error'}`);
        }
    },
});

