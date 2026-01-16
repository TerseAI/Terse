import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { client, v2 } from "@datadog/datadog-api-client";
import logger from "../../../logger";
import { db } from "../../../prismaClient";
import { DatadogConfig } from "../../../shared/Configs";
import { getDatadogSite, getDatadogAppUrl } from "../../../utility/datadog";

/**
 * Tool for aggregating Datadog RUM events into computed metrics and timeseries.
 * This tool queries the Datadog RUM API v2 aggregate endpoint to compute metrics like percentiles,
 * averages, sums, etc. on RUM events. Use this to analyze performance trends, error rates,
 * user behavior patterns, or any aggregated metrics over RUM events.
 */
export const aggregateRumEventsTool = tool({
    name: 'aggregateRumEvents',
    description: 'Aggregate Datadog RUM events into computed metrics and timeseries. Returns aggregated data with computed metrics (percentiles, averages, sums, etc.) grouped by facets. Use this to analyze performance trends (e.g., page load times), error rates, user behavior patterns, or any aggregated metrics over RUM events. This is useful for understanding trends, averages, and distributions rather than individual events.',
    parameters: z.object({
        query: z.union([z.string(), z.null()]).describe('Optional: Datadog RUM search query syntax to filter events before aggregation (e.g., "@type:view AND @session.type:user", "@type:error").'),
        from: z.string().describe('Start time for filtering (ISO8601 format like "2020-09-17T11:48:36+01:00" or relative like "now-15m"). Required parameter.'),
        to: z.union([z.string(), z.null()]).describe('Optional: End time for filtering (ISO8601 format). If not provided, defaults to "now".'),
        compute: z.array(z.object({
            aggregation: z.enum(['count', 'pc90', 'pc95', 'pc99', 'avg', 'sum', 'min', 'max', 'cardinality']).describe('Aggregation function: count (total events), pc90/pc95/pc99 (percentiles), avg, sum, min, max, cardinality (unique count).'),
            metric: z.string().describe('Metric to compute on (e.g., "@view.time_spent", "@view.loading_time", "@duration"). For count aggregation, you can use "*" or omit the metric to count all events.'),
            type: z.enum(['total', 'timeseries']).default('total').describe('Type of computation: "total" for overall aggregate, "timeseries" for time-bucketed results.'),
        })).describe('Array of metrics to compute. At least one compute is required.'),
        groupBy: z.union([z.array(z.object({
            facet: z.string().describe('Facet to group by (e.g., "@view.name", "@view.url", "@service", "@browser.name").'),
            limit: z.number().default(10).describe('Maximum number of groups to return (default: 10).'),
            total: z.boolean().default(false).describe('Whether to include a "total" group with all events combined (default: false).'),
        })), z.null()]).describe('Optional: Array of facets to group results by. Results will be grouped by all specified facets.'),
        timezone: z.string().default('GMT').describe('Optional: Timezone for time-based queries (default: "GMT").'),
        pageLimit: z.number().default(25).describe('Optional: Maximum number of buckets to return (default: 25).'),
    }),
    execute: async ({ 
        query, 
        from, 
        to, 
        compute,
        groupBy,
        timezone, 
        pageLimit 
    }, runContext?: RunContext<any>) => {
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

        // Validate compute array
        if (!compute || compute.length === 0) {
            throw new Error("At least one compute metric is required");
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

            // Build link to Datadog RUM UI
            const appUrl = getDatadogAppUrl(region);
            const rumLink = `${appUrl}/rum/explorer`;

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
            const totalComputes = compute.length;

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
            logger.error('Error aggregating Datadog RUM events', { 
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
                throw new Error(`Invalid Datadog API request: ${error.message || 'Bad request'}. Common issues: invalid metric names, invalid aggregation types, or malformed query syntax.`);
            }
            
            throw new Error(`Failed to aggregate Datadog RUM events: ${error.message || 'Unknown error'}`);
        }
    },
});
