import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { client, v2 } from "@datadog/datadog-api-client";
import logger from "../../../logger";
import { getDatadogSite, getDatadogRumDeepLink } from "../../../utility/datadog";
import { IntegrationType } from "../../../shared/Integrations";
import { RunHistoryActionType } from "@prisma/client";
import { Session } from "../../../server";
import { SessionWithTracking } from "../../../agent/ChannelAgent/ChannelAgent";
import { getDatadogCredentialsByIntegrationId } from "../datadogApiClient";

/**
 * Tool for aggregating Datadog RUM events into computed metrics and timeseries.
 * This tool queries the Datadog RUM API v2 aggregate endpoint to compute metrics like percentiles,
 * averages, sums, etc. on RUM events. Use this to analyze performance trends, error rates,
 * user behavior patterns, or any aggregated metrics over RUM events.
 */
export const aggregateRumEventsTool = tool({
    name: 'aggregateRumEvents',
    description: 'Aggregate Datadog RUM events into metrics. Compute percentiles, averages, sums, etc. Group by facets for breakdowns. Use for performance trends and error rates.',
    parameters: z.object({
        query: z.union([z.string(), z.null()]).describe('Datadog RUM search query to filter events before aggregation (e.g., @type:view)'),
        from: z.string().describe('Start time (ISO8601 or relative like "now-15m")'),
        to: z.union([z.string(), z.null()]).describe('End time (ISO8601). Defaults to "now" if not provided.'),
        compute: z.array(z.object({
            aggregation: z.enum(['count', 'pc90', 'pc95', 'pc99', 'avg', 'sum', 'min', 'max', 'cardinality']).describe('Aggregation: count, pc90/pc95/pc99, avg, sum, min, max, cardinality'),
            metric: z.string().describe('Metric to compute (e.g., @view.loading_time, @duration). Use "*" for count of all events.'),
            type: z.enum(['total', 'timeseries']).default('total').describe('Computation type: "total" (overall) or "timeseries" (time-bucketed)'),
        })).describe('Array of metrics to compute. At least one required.'),
        groupBy: z.union([z.array(z.object({
            facet: z.string().describe('Facet to group by (e.g., @view.name, @service, @browser.name)'),
            limit: z.number().default(10).describe('Maximum number of groups to return (default: 10)'),
            total: z.boolean().default(false).describe('Include "total" group with all events combined (default: false)'),
        })), z.null()]).describe('Facets to group results by'),
        timezone: z.string().default('GMT').describe('Timezone for time-based queries (default: "GMT")'),
        pageLimit: z.number().default(25).describe('Maximum number of buckets to return (default: 25)'),
        integrationId: z.string().describe('The integration ID of the Datadog knowledge base to use.'),
    }),
    execute: async ({ 
        integrationId,
        query, 
        from, 
        to, 
        compute,
        groupBy,
        timezone, 
        pageLimit 
    }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        // Validate compute array
        if (!compute || compute.length === 0) {
            logger.warn('[Datadog] aggregateRumEvents - Validation failed', {
                tool: 'aggregateRumEvents',
                error: 'At least one compute metric is required',
                providedParams: {
                    compute: compute?.length || 0,
                    groupBy: groupBy?.length || 0,
                    from,
                    to: to || null
                }
            });
            throw new Error("At least one compute metric is required");
        }

        const credentials = await getDatadogCredentialsByIntegrationId(integrationId, runContext.context.user.id);
        if (!credentials) {
            throw new Error(`Datadog integration not found or access denied for integrationId: ${integrationId}`);
        }

        const { apiKey, appKey, region } = credentials;
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

            // Build compute array for request
            const computeArray = compute.map(comp => ({
                aggregation: comp.aggregation as v2.RUMAggregationFunction,
                metric: comp.metric,
                type: comp.type as v2.RUMComputeType,
            }));

            // Build group_by array if provided
            const groupByArray = groupBy?.map(gb => ({
                facet: gb.facet,
                limit: gb.limit || 10,
                total: gb.total || false,
            }));

            // Build request body for RUM events aggregation
            const requestBody: v2.RUMAggregateRequest = {
                compute: computeArray,
                filter: {
                    from: from,
                    query: query ?? undefined,
                    to: to ?? 'now',
                },
                groupBy: groupByArray,
                options: {
                    timezone: timezone ?? 'GMT',
                },
                page: {
                    limit: Math.min(pageLimit ?? 25, 1000), // Datadog max is 1000
                },
            };

            logger.info('Aggregating Datadog RUM events', { 
                query, 
                from, 
                to,
                computeCount: compute.length,
                groupByCount: groupBy?.length || 0,
                region 
            });

            // Log full request context (debug level)
            logger.debug('[Datadog] aggregateRumEvents - Request details', {
                tool: 'aggregateRumEvents',
                integrationId,
                userId: runContext.context.user.id,
                requestParams: {
                    query: query || null,
                    from,
                    to: to || 'now',
                    compute: compute.map(c => ({
                        aggregation: c.aggregation,
                        metric: c.metric,
                        type: c.type
                    })),
                    groupBy: groupBy?.map(gb => ({
                        facet: gb.facet,
                        limit: gb.limit || 10,
                        total: gb.total || false
                    })) || null,
                    timezone,
                    pageLimit: Math.min(pageLimit ?? 25, 1000)
                },
                region,
                site
            });

            // Call Datadog RUM API
            const response = await rumApi.aggregateRUMEvents({ body: requestBody });

            // Parse response
            const data = response.data;
            const buckets = data?.buckets || [];
            const meta = response.meta;
            const links = response.links;

            // Format aggregated buckets
            const formattedBuckets = buckets.map((bucket: any) => {
                const formatted: any = {
                    by: bucket.by || {},
                    computes: {},
                };

                // Format computed metrics
                if (bucket.computes) {
                    Object.entries(bucket.computes).forEach(([key, value]: [string, any]) => {
                        formatted.computes[key] = {
                            value: value,
                            aggregation: compute.find(c => c.metric === key)?.aggregation || 'unknown',
                            metric: key,
                        };
                    });
                }

                return formatted;
            });

            // Build deep link to Datadog RUM UI with query parameters
            const rumLink = getDatadogRumDeepLink(region, query, from, to);

            // Determine if there are more results available
            const nextCursor = meta?.page?.after || null;
            const hasMore = !!nextCursor;

            // Build filter description
            const filterDescriptions: string[] = [];
            if (query) {
                filterDescriptions.push(`query="${query}"`);
            }
            filterDescriptions.push(`from: ${from}`);
            if (to && to !== 'now') {
                filterDescriptions.push(`to: ${to}`);
            }
            const filterDescription = filterDescriptions.join(', ');

            // Build compute description
            const computeDescriptions = compute.map(c => `${c.aggregation}(${c.metric})`).join(', ');
            
            // Build group by description
            const groupByDescription = groupBy && groupBy.length > 0 
                ? `grouped by ${groupBy.map(gb => gb.facet).join(', ')}` 
                : 'not grouped';

            // Include warnings if present
            const warnings = meta?.warnings || [];
            const warningMessages = warnings.map((w: any) => `${w.title}: ${w.detail}`).join('; ');

            // Summary of results
            const bucketCount = formattedBuckets.length;

            // Log success response (info level - summary)
            logger.info('[Datadog] aggregateRumEvents - Success', {
                bucketCount,
                computeDescriptions,
                groupByDescription,
                hasMore,
                filterDescription,
                region
            });

            // Log detailed response metadata (debug level)
            logger.debug('[Datadog] aggregateRumEvents - Response details', {
                bucketCount,
                pagination: {
                    limit: Math.min(pageLimit ?? 25, 1000),
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
                computeDescriptions,
                groupByDescription,
                sampleBuckets: formattedBuckets.slice(0, 3).map(bucket => ({
                    by: bucket.by,
                    computeCount: Object.keys(bucket.computes).length
                }))
            });

            // Track the action
            runContext.context.trackAction({
                action: 'Aggregated Datadog RUM events',
                integration: IntegrationType.DATADOG,
                target: 'RUM events',
                details: `Computed ${computeDescriptions} on RUM events (${filterDescription}) ${groupByDescription}. Found ${bucketCount} bucket${bucketCount !== 1 ? 's' : ''}${hasMore ? ' (more available)' : ''}`,
                url: rumLink,
                type: RunHistoryActionType.read,
                isReadOnly: true,
            });

            return {
                success: true,
                query: query || null,
                from,
                to,
                compute: computeDescriptions,
                groupBy: groupByDescription,
                totalBuckets: bucketCount,
                buckets: formattedBuckets,
                rumLink,
                pagination: {
                    limit: Math.min(pageLimit, 1000),
                    nextCursor,
                    hasMore,
                    showing: `${bucketCount} bucket${bucketCount !== 1 ? 's' : ''}`,
                },
                warnings: warnings.length > 0 ? warningMessages : null,
                meta: {
                    elapsed: meta?.elapsed,
                    requestId: meta?.requestId,
                    status: meta?.status,
                },
                message: `Computed ${computeDescriptions} on RUM events (${filterDescription}) ${groupByDescription}. Found ${bucketCount} bucket${bucketCount !== 1 ? 's' : ''}${hasMore ? ' (more available)' : ''}. View in Datadog: ${rumLink}${warnings.length > 0 ? `\nWarnings: ${warningMessages}` : ''}`
            };
        } catch (error: any) {
            logger.error('[Datadog] aggregateRumEvents - Error', { 
                error: error.message,
                errorStatus: error.status,
                errorCode: error.code,
                requestParams: {
                    query, 
                    from, 
                    to: to || 'now',
                    computeCount: compute?.length || 0,
                    groupByCount: groupBy?.length || 0,
                    timezone,
                    pageLimit,
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
                throw new Error(`Invalid Datadog API request: ${error.message || 'Bad request'}. Common issues: invalid metric names, invalid aggregation types, or malformed query syntax.`);
            }
            
            throw new Error(`Failed to aggregate Datadog RUM events: ${error.message || 'Unknown error'}`);
        }
    },
});
