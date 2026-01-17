import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import logger from "../../../logger";
import { db } from "../../../prismaClient";
import { LaunchDarklyConfig } from "../../../shared/Configs";
import { IntegrationType } from "../../../shared/Integrations";

/**
 * Tool for searching LaunchDarkly audit logs for feature flag changes.
 */
export const getLaunchDarklyFlagHistoryTool = tool({
    name: 'getLaunchDarklyFlagHistory',
    description: 'Search audit logs for changes to feature flags over time. Returns timestamped entries showing when flags were enabled/disabled, targeting rules changed, or other modifications. Use this to understand when certain actions occurred and track flag evolution.',
    parameters: z.object({
        flagKey: z.union([z.string(), z.null()]).optional().describe('Optional: Specific flag to search for (if not provided, returns changes for all flags).'),
        before: z.union([z.string(), z.null()]).optional().describe('Optional: ISO date - only return entries before this date.'),
        after: z.union([z.string(), z.null()]).optional().describe('Optional: ISO date - only return entries after this date.'),
        limit: z.number().default(20).describe('Number of entries to return (default: 20, max: 100).'),
    }),
    execute: async ({ flagKey, before, after, limit = 20 }, runContext?: RunContext<any>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        // Get LaunchDarkly config from context - must be set by the knowledge base session
        const launchDarklyConfig = runContext.context.launchDarklyConfig as LaunchDarklyConfig | undefined;
        if (!launchDarklyConfig) {
            throw new Error("LaunchDarkly config not found in context. Ensure LaunchDarkly is configured as a knowledge base.");
        }

        const user = runContext.context.user;
        if (!user) {
            throw new Error("User not found in context");
        }

        // Get LaunchDarkly integration
        const integration = await db().launchdarkly_integrations.findUnique({
            where: { id: launchDarklyConfig.integrationId },
        });

        if (!integration) {
            throw new Error(`LaunchDarkly integration not found: ${launchDarklyConfig.integrationId}`);
        }

        const apiKey = integration.api_key;
        const projectKey = launchDarklyConfig.projectKey;
        const launchDarklyHost = 'https://app.launchdarkly.com';

        try {
            logger.info('Getting LaunchDarkly flag history', { projectKey, flagKey, before, after, limit });

            // Build query parameters
            const params = new URLSearchParams();
            if (flagKey) {
                // Build query string for flag-related events
                params.append('q', `kind:flag,key:${flagKey}`);
            } else {
                // Search for all flag-related events
                params.append('q', 'kind:flag');
            }
            if (before) {
                params.append('before', before);
            }
            if (after) {
                params.append('after', after);
            }
            params.append('limit', Math.min(limit, 100).toString());

            // Call LaunchDarkly API
            const auditLogUrl = `${launchDarklyHost}/api/v2/auditlog?${params.toString()}`;
            
            const response = await fetch(auditLogUrl, {
                method: 'GET',
                headers: {
                    'Authorization': apiKey,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error('LaunchDarkly audit log API error', {
                    status: response.status,
                    error: errorText,
                    projectKey,
                    flagKey
                });
                
                if (response.status === 401) {
                    throw new Error('LaunchDarkly API key is invalid or expired. Please update your LaunchDarkly integration.');
                } else if (response.status === 403) {
                    throw new Error('LaunchDarkly API key does not have required permissions. Please ensure your API key has the correct scope.');
                }
                
                throw new Error(`Failed to get LaunchDarkly flag history: ${errorText}`);
            }

            const auditLogData = await response.json();
            
            // Extract audit log entries from response
            const entries = Array.isArray(auditLogData) 
                ? auditLogData 
                : (auditLogData.items || auditLogData.entries || []);

            // Format audit log entries
            const formattedEntries = entries.map((entry: any) => {
                return {
                    id: entry.id || entry._id || '',
                    timestamp: entry.date || entry.timestamp || entry.createdAt || '',
                    kind: entry.kind || entry.resourceKind || '',
                    key: entry.resourceKey || entry.key || flagKey || '',
                    name: entry.resourceName || entry.name || '',
                    description: entry.description || entry.comment || '',
                    member: entry.member || entry.actor || null,
                    changes: entry.changes || [],
                };
            });

            // Sort by timestamp descending (most recent first)
            formattedEntries.sort((a: any, b: any) => {
                const timeA = new Date(a.timestamp || 0).getTime();
                const timeB = new Date(b.timestamp || 0).getTime();
                return timeB - timeA;
            });

            const auditLogLink = `${launchDarklyHost}/${projectKey}/settings/audit-log`;

            // Track the action
            runContext.context.trackAction({
                action: 'Retrieved flag history',
                integration: IntegrationType.LAUNCHDARKLY,
                target: flagKey || 'All flags',
                details: `Retrieved ${formattedEntries.length} audit log entries${flagKey ? ` for flag "${flagKey}"` : ''}${after ? ` since ${after}` : ''}`,
                url: auditLogLink,
                type: 'read',
                isReadOnly: true,
            });

            return {
                success: true,
                projectKey,
                flagKey: flagKey || null,
                totalEntries: formattedEntries.length,
                entries: formattedEntries,
                auditLogLink,
                message: `Found ${formattedEntries.length} audit log entry(ies)${flagKey ? ` for flag "${flagKey}"` : ''} in project ${projectKey}. View audit log: ${auditLogLink}`
            };
        } catch (error: any) {
            logger.error('Error getting LaunchDarkly flag history', { error, projectKey, flagKey });
            throw new Error(`Failed to get LaunchDarkly flag history: ${error.message || 'Unknown error'}`);
        }
    },
});
