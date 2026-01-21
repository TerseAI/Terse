import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import logger from "../../../logger";
import { IntegrationType } from "../../../shared/Integrations";
import { Session } from "../../../server";
import { SessionWithTracking } from "../../../agent/ChannelAgent/ChannelAgent";
import { getLaunchDarklyApiKeyByIntegrationId } from "../launchdarklyApiClient";

/**
 * Tool for getting detailed information about a specific LaunchDarkly feature flag.
 * Optionally includes change history over a time window.
 */
export const getLaunchDarklyFlagDetailsTool = tool({
    name: 'getLaunchDarklyFlagDetails',
    description: 'Get detailed information about a specific feature flag including targeting rules, rollout strategies, variations, and per-environment configuration. Optionally includes change history when includeHistory=true.',
    parameters: z.object({
        integrationId: z.string().describe('The integration ID of the LaunchDarkly knowledge base to use.'),
        projectKey: z.string().describe('The LaunchDarkly project key.'),
        environmentKeys: z.array(z.string()).describe('Array of environment keys to query.'),
        flagKey: z.string().describe('The flag key to retrieve.'),
        environmentKey: z.union([z.string(), z.null()]).optional().describe('Optional: Specific environment to get details for (if not provided, returns all configured environments).'),
        includeHistory: z.boolean().default(false).describe('If true, includes change history for the flag over the specified time window.'),
        before: z.union([z.string(), z.null()]).optional().describe('Optional: ISO date - only return history entries before this date (only used if includeHistory is true).'),
        after: z.union([z.string(), z.null()]).optional().describe('Optional: ISO date - only return history entries after this date (only used if includeHistory is true).'),
        historyLimit: z.number().default(20).describe('Number of history entries to return if includeHistory is true (default: 20, max: 20).'),
    }),
    execute: async ({ integrationId, projectKey, environmentKeys, flagKey, environmentKey, includeHistory = false, before, after, historyLimit = 20 }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.info('[LaunchDarkly] getFeatureFlagDetails - Tool called', {
            integrationId,
            projectKey,
            environmentKeys,
            flagKey,
            environmentKey,
            includeHistory,
            before,
            after,
            historyLimit
        });

        if (!runContext?.context) {
            logger.error('[LaunchDarkly] getFeatureFlagDetails - No context provided');
            throw new Error("No context provided");
        }

        const apiKey = await getLaunchDarklyApiKeyByIntegrationId(integrationId, runContext.context.user.id);
        if (!apiKey) {
            throw new Error(`LaunchDarkly integration not found or access denied for integrationId: ${integrationId}`);
        }

        const environmentKeysToUse = environmentKey ? [environmentKey] : environmentKeys;
        const launchDarklyHost = 'https://app.launchdarkly.com';

        try {
            logger.info('[LaunchDarkly] getFeatureFlagDetails - Starting flag details fetch', {
                projectKey,
                flagKey,
                environmentKey,
                environmentKeys: environmentKeysToUse,
                includeHistory
            });

            // Call LaunchDarkly API
            const flagUrl = `${launchDarklyHost}/api/v2/flags/${projectKey}/${flagKey}`;
            
            logger.debug('[LaunchDarkly] getFeatureFlagDetails - Fetching flag details from API', {
                url: flagUrl,
                projectKey,
                flagKey,
                hasApiKey: !!apiKey
            });
            
            const response = await fetch(flagUrl, {
                method: 'GET',
                headers: {
                    'Authorization': apiKey,
                    'Content-Type': 'application/json',
                },
            });

            logger.debug('[LaunchDarkly] getFeatureFlagDetails - Flag details API response', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                headers: Object.fromEntries(response.headers.entries())
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error('[LaunchDarkly] getFeatureFlagDetails - Flag details API error', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText,
                    projectKey,
                    flagKey,
                    url: flagUrl
                });
                
                if (response.status === 401) {
                    throw new Error('LaunchDarkly API key is invalid or expired. Please update your LaunchDarkly integration.');
                } else if (response.status === 403) {
                    throw new Error('LaunchDarkly API key does not have required permissions. Please ensure your API key has the correct scope.');
                } else if (response.status === 404) {
                    throw new Error(`LaunchDarkly flag ${flagKey} not found in project ${projectKey}. Please verify the flag key.`);
                }
                
                throw new Error(`Failed to get LaunchDarkly flag details: ${errorText}`);
            }

            const flagData = await response.json();
            
            logger.debug('[LaunchDarkly] getFeatureFlagDetails - Flag details response parsed', {
                hasKey: !!flagData.key,
                hasName: !!flagData.name,
                hasEnvironments: !!flagData.environments,
                environmentKeys: flagData.environments ? Object.keys(flagData.environments) : [],
                responseKeys: Object.keys(flagData)
            });
            
            // Extract flag metadata
            const flagMetadata = {
                key: flagData.key || flagData._key || flagKey,
                name: flagData.name || flagKey,
                description: flagData.description || '',
                kind: flagData.kind || 'boolean',
                variations: flagData.variations || [],
                tags: flagData.tags || [],
                maintainerId: flagData.maintainerId || null,
            };

            // Extract per-environment configuration
            const environments: Record<string, any> = {};
            for (const envKey of environmentKeysToUse) {
                const envData = flagData.environments?.[envKey];
                if (envData) {
                    environments[envKey] = {
                        on: envData.on || false,
                        targets: envData.targets || [],
                        contextTargets: envData.contextTargets || [],
                        rules: envData.rules || [],
                        fallthrough: envData.fallthrough || null,
                        offVariation: envData.offVariation || null,
                        prerequisites: envData.prerequisites || [],
                    };
                } else {
                    environments[envKey] = {
                        on: false,
                        targets: [],
                        contextTargets: [],
                        rules: [],
                        fallthrough: null,
                        offVariation: null,
                        prerequisites: [],
                    };
                }
            }

            // Use first environment for the flag URL (or the specified environment)
            const primaryEnv = environmentKey || (environmentKeysToUse.length > 0 ? environmentKeysToUse[0] : '');
            const flagUrl_ui = primaryEnv
                ? `${launchDarklyHost}/projects/${projectKey}/flags/${flagKey}/targeting?env=${primaryEnv}&selected-env=${primaryEnv}`
                : `${launchDarklyHost}/projects/${projectKey}/flags/${flagKey}`;

            // Optionally fetch history if requested
            let historyEntries: any[] = [];
            let historyLink: string | null = null;
            
            if (includeHistory) {
                try {
                    logger.info('[LaunchDarkly] getFeatureFlagDetails - Fetching flag history', {
                        projectKey,
                        flagKey,
                        before,
                        after,
                        historyLimit,
                        configuredEnvironments: environmentKeysToUse
                    });

                    // Build query parameters for audit log
                    const historyParams = new URLSearchParams();
                    const queryString = `kind:flag,key:${flagKey}`;
                    historyParams.append('q', queryString);
                    if (before) {
                        historyParams.append('before', before);
                    }
                    if (after) {
                        historyParams.append('after', after);
                    }
                    historyParams.append('limit', Math.min(historyLimit, 20).toString());

                    const auditLogUrl = `${launchDarklyHost}/api/v2/auditlog?${historyParams.toString()}`;
                    
                    logger.debug('[LaunchDarkly] getFeatureFlagDetails - Audit log API request', {
                        url: auditLogUrl,
                        queryString,
                        params: Object.fromEntries(historyParams.entries()),
                        hasApiKey: !!apiKey
                    });

                    // Call LaunchDarkly audit log API
                    const historyResponse = await fetch(auditLogUrl, {
                        method: 'GET',
                        headers: {
                            'Authorization': apiKey,
                            'Content-Type': 'application/json',
                        },
                    });

                    logger.debug('[LaunchDarkly] getFeatureFlagDetails - Audit log API response', {
                        status: historyResponse.status,
                        statusText: historyResponse.statusText,
                        ok: historyResponse.ok,
                        headers: Object.fromEntries(historyResponse.headers.entries())
                    });

                    if (historyResponse.ok) {
                        const auditLogData = await historyResponse.json();
                        
                        logger.debug('[LaunchDarkly] getFeatureFlagDetails - Audit log response parsed', {
                            isArray: Array.isArray(auditLogData),
                            hasItems: !!(auditLogData as any).items,
                            hasEntries: !!(auditLogData as any).entries,
                            responseKeys: Object.keys(auditLogData),
                            rawDataStructure: Array.isArray(auditLogData) 
                                ? `Array with ${auditLogData.length} items`
                                : JSON.stringify(auditLogData).substring(0, 200)
                        });
                        
                        // Extract audit log entries from response
                        const entries = Array.isArray(auditLogData) 
                            ? auditLogData 
                            : (auditLogData.items || auditLogData.entries || []);

                        logger.info('[LaunchDarkly] getFeatureFlagDetails - Extracted audit log entries', {
                            totalEntries: entries.length,
                            firstEntrySample: entries.length > 0 ? {
                                hasId: !!(entries[0] as any).id || !!(entries[0] as any)._id,
                                hasDate: !!(entries[0] as any).date,
                                hasTimestamp: !!(entries[0] as any).timestamp,
                                hasKind: !!(entries[0] as any).kind,
                                hasKey: !!(entries[0] as any).key || !!(entries[0] as any).resourceKey,
                                entryKeys: Object.keys(entries[0] || {})
                            } : null
                        });

                        // Format audit log entries
                        historyEntries = entries.map((entry: any, index: number) => {
                            const formatted = {
                                id: entry.id || entry._id || '',
                                timestamp: entry.date || entry.timestamp || entry.createdAt || '',
                                kind: entry.kind || entry.resourceKind || '',
                                key: entry.resourceKey || entry.key || flagKey,
                                name: entry.resourceName || entry.name || '',
                                description: entry.description || entry.comment || '',
                                member: entry.member || entry.actor || null,
                                changes: entry.changes || [],
                            };
                            
                            if (index === 0) {
                                logger.debug('[LaunchDarkly] getFeatureFlagDetails - Sample formatted entry', {
                                    originalEntry: entry,
                                    formattedEntry: formatted
                                });
                            }
                            
                            return formatted;
                        });

                        logger.info('[LaunchDarkly] getFeatureFlagDetails - Formatted audit log entries', {
                            formattedCount: historyEntries.length,
                            entriesWithTimestamp: historyEntries.filter(e => e.timestamp).length
                        });

                        // Sort by timestamp descending (most recent first)
                        historyEntries.sort((a: any, b: any) => {
                            const timeA = new Date(a.timestamp || 0).getTime();
                            const timeB = new Date(b.timestamp || 0).getTime();
                            return timeB - timeA;
                        });

                        // Build monitoring URL for flag history
                        if (environmentKeysToUse.length > 0) {
                            const firstEnv = environmentKeysToUse[0];
                            historyLink = `${launchDarklyHost}/projects/${projectKey}/flags/${flagKey}/monitoring?env=${encodeURIComponent(firstEnv)}&selected-env=${encodeURIComponent(firstEnv)}&contextKind=user&errorChartType=rate&errorContextKind=user&errorEventKey=%24ld%3Atelemetry%3Aerror`;
                            logger.debug('[LaunchDarkly] getFeatureFlagDetails - Built history link', { historyLink });
                        } else {
                            logger.warn('[LaunchDarkly] getFeatureFlagDetails - No environments configured, cannot build history link');
                        }
                    } else {
                        const errorText = await historyResponse.text();
                        logger.error('[LaunchDarkly] getFeatureFlagDetails - Audit log API error', {
                            status: historyResponse.status,
                            statusText: historyResponse.statusText,
                            error: errorText,
                            projectKey,
                            flagKey,
                            url: auditLogUrl,
                            queryString
                        });
                    }
                } catch (historyError: any) {
                    logger.error('[LaunchDarkly] getFeatureFlagDetails - Exception fetching flag history', {
                        error: historyError,
                        errorMessage: historyError?.message,
                        errorStack: historyError?.stack,
                        projectKey,
                        flagKey
                    });
                    // Don't throw - history is optional, continue with flag details
                }
            } else {
                logger.debug('[LaunchDarkly] getFeatureFlagDetails - History not requested (includeHistory=false)');
            }

            // Track the action
            const actionDetails = includeHistory 
                ? `Retrieved details and ${historyEntries.length} history entries for flag "${flagKey}"`
                : `Retrieved details for flag "${flagKey}"`;
            
            const action = {
                action: 'Retrieved flag details',
                integration: IntegrationType.LAUNCHDARKLY,
                target: flagKey,
                details: actionDetails,
                url: flagUrl_ui,
                type: 'read',
                isReadOnly: true,
            };

            const result: any = {
                success: true,
                actions: [action],
                projectKey,
                flag: flagMetadata,
                environments,
                url: flagUrl_ui,
                message: `Retrieved details for flag "${flagKey}" in project ${projectKey}. View flag: ${flagUrl_ui}`
            };

            if (includeHistory) {
                result.history = {
                    entries: historyEntries,
                    totalEntries: historyEntries.length,
                    url: historyLink || flagUrl_ui
                };
                
                logger.info('[LaunchDarkly] getFeatureFlagDetails - History included in result', {
                    historyEntriesCount: historyEntries.length,
                    hasHistoryLink: !!historyLink
                });
                
                if (historyEntries.length > 0) {
                    result.message += `\nFound ${historyEntries.length} change(s) in history. View monitoring: ${historyLink || flagUrl_ui}`;
                } else {
                    logger.warn('[LaunchDarkly] getFeatureFlagDetails - History requested but no entries returned', {
                        flagKey,
                        before,
                        after,
                        historyLimit
                    });
                }
            }

            logger.info('[LaunchDarkly] getFeatureFlagDetails - Success', {
                flagKey,
                projectKey,
                environmentsCount: Object.keys(environments).length,
                includeHistory,
                historyEntriesCount: historyEntries.length
            });

            return result;
        } catch (error: any) {
            logger.error('[LaunchDarkly] getFeatureFlagDetails - Error', {
                error: error,
                errorMessage: error?.message,
                errorStack: error?.stack,
                projectKey,
                flagKey,
                includeHistory
            });
            throw new Error(`Failed to get LaunchDarkly flag details: ${error.message || 'Unknown error'}`);
        }
    },
});
