import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import logger from "../../../logger";
import { IntegrationType } from "../../../shared/Integrations";
import { Session } from "../../../server";
import { SessionWithTracking } from "../../../agent/ChannelAgent/ChannelAgent";
import { getLaunchDarklyApiKeyByIntegrationId } from "../launchdarklyApiClient";

/**
 * Tool for listing LaunchDarkly feature flags with their enabled/disabled states per environment.
 */
export const listLaunchDarklyFlagsTool = tool({
    name: 'listLaunchDarklyFlags',
    description: 'List all feature flags with enabled/disabled states per environment. Use summary=true for quick overview, summary=false for full details.',
    parameters: z.object({
        integrationId: z.string().describe('The integration ID of the LaunchDarkly knowledge base to use.'),
        projectKey: z.string().describe('The LaunchDarkly project key.'),
        environmentKeys: z.array(z.string()).describe('Array of environment keys to query.'),
        summary: z.boolean().default(true).describe('If true, return only flag key, name, and on/off state per environment. If false, return full flag details.'),
        filter: z.union([z.string(), z.null()]).optional().describe('Optional: Filter flags by name/key containing this text.'),
        tags: z.union([z.array(z.string()), z.null()]).optional().describe('Optional: Filter flags by tags.'),
    }),
    execute: async ({ integrationId, projectKey, environmentKeys, summary = true, filter, tags }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.info('[LaunchDarkly] listFeatureFlags - Tool called', {
            integrationId,
            projectKey,
            environmentKeys,
            summary,
            filter,
            tags
        });

        if (!runContext?.context) {
            logger.error('[LaunchDarkly] listFeatureFlags - No context provided');
            throw new Error("No context provided");
        }

        const apiKey = await getLaunchDarklyApiKeyByIntegrationId(integrationId, runContext.context.user.id);
        if (!apiKey) {
            throw new Error(`LaunchDarkly integration not found or access denied for integrationId: ${integrationId}`);
        }

        const launchDarklyHost = 'https://app.launchdarkly.com';

        try {
            logger.info('[LaunchDarkly] listFeatureFlags - Starting flags fetch', {
                projectKey,
                summary,
                filter,
                tags,
                environmentKeys
            });

            // Build query parameters
            const params = new URLSearchParams({
                summary: summary.toString(),
            });

            // Call LaunchDarkly API
            const flagsUrl = `${launchDarklyHost}/api/v2/flags/${projectKey}?${params.toString()}`;
            
            logger.debug('[LaunchDarkly] listFeatureFlags - Fetching flags from API', {
                url: flagsUrl,
                projectKey,
                summary,
                params: Object.fromEntries(params.entries()),
                hasApiKey: !!apiKey
            });
            
            const response = await fetch(flagsUrl, {
                method: 'GET',
                headers: {
                    'Authorization': apiKey,
                    'Content-Type': 'application/json',
                },
            });

            logger.debug('[LaunchDarkly] listFeatureFlags - Flags API response', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                headers: Object.fromEntries(response.headers.entries())
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error('[LaunchDarkly] listFeatureFlags - Flags API error', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText,
                    projectKey,
                    url: flagsUrl
                });
                
                if (response.status === 401) {
                    throw new Error('LaunchDarkly API key is invalid or expired. Please update your LaunchDarkly integration.');
                } else if (response.status === 403) {
                    throw new Error('LaunchDarkly API key does not have required permissions. Please ensure your API key has the correct scope.');
                } else if (response.status === 404) {
                    throw new Error(`LaunchDarkly project ${projectKey} not found. Please verify the project key in your configuration.`);
                }
                
                throw new Error(`Failed to list LaunchDarkly flags: ${errorText}`);
            }

            const flagsData = await response.json();
            
            logger.debug('[LaunchDarkly] listFeatureFlags - Flags response parsed', {
                isArray: Array.isArray(flagsData),
                hasItems: !!(flagsData as any).items,
                hasFlags: !!(flagsData as any).flags,
                responseKeys: Object.keys(flagsData),
                rawCount: Array.isArray(flagsData) ? flagsData.length : ((flagsData as any).items?.length || (flagsData as any).flags?.length || 0)
            });
            
            // Extract flags from response (could be array or object with items property)
            const flags = Array.isArray(flagsData) 
                ? flagsData 
                : (flagsData.items || flagsData.flags || []);

            logger.info('[LaunchDarkly] listFeatureFlags - Extracted flags', {
                totalFlags: flags.length,
                firstFlagSample: flags.length > 0 ? {
                    hasKey: !!(flags[0] as any).key,
                    hasName: !!(flags[0] as any).name,
                    hasEnvironments: !!(flags[0] as any).environments,
                    flagKeys: Object.keys(flags[0] || {})
                } : null
            });

            // Apply filters
            let filteredFlags = flags;
            logger.debug('[LaunchDarkly] listFeatureFlags - Applying filters', {
                beforeFilter: flags.length,
                filter,
                tags
            });

            if (filter) {
                const filterLower = filter.toLowerCase();
                const beforeFilterCount = filteredFlags.length;
                filteredFlags = filteredFlags.filter((flag: any) => 
                    (flag.key && flag.key.toLowerCase().includes(filterLower)) ||
                    (flag.name && flag.name.toLowerCase().includes(filterLower))
                );
                logger.debug('[LaunchDarkly] listFeatureFlags - Applied filter', {
                    beforeFilter: beforeFilterCount,
                    afterFilter: filteredFlags.length,
                    filter
                });
            }
            if (tags && tags.length > 0) {
                const beforeTagFilter = filteredFlags.length;
                filteredFlags = filteredFlags.filter((flag: any) => {
                    const flagTags = flag.tags || [];
                    return tags.some(tag => flagTags.includes(tag));
                });
                logger.debug('[LaunchDarkly] listFeatureFlags - Applied tag filter', {
                    beforeFilter: beforeTagFilter,
                    afterFilter: filteredFlags.length,
                    tags
                });
            }

            // Format flags with environment states
            const formattedFlags = filteredFlags.map((flag: any) => {
                const flagKey = flag.key || flag._key || '';
                const flagName = flag.name || flagKey;
                const flagDescription = flag.description || '';
                
                // Extract environment states
                const environmentStates: Record<string, boolean> = {};
                for (const envKey of environmentKeys) {
                    const envData = flag.environments?.[envKey];
                    environmentStates[envKey] = envData?.on || false;
                }

                // Build URLs for each environment
                const environmentUrls: Record<string, string> = {};
                for (const envKey of environmentKeys) {
                    environmentUrls[envKey] = `${launchDarklyHost}/projects/${projectKey}/flags/${flagKey}/targeting?env=${encodeURIComponent(envKey)}&selected-env=${encodeURIComponent(envKey)}`;
                }
                // Primary URL uses first environment
                const primaryUrl = environmentKeys.length > 0 
                    ? `${launchDarklyHost}/projects/${projectKey}/flags/${flagKey}/targeting?env=${encodeURIComponent(environmentKeys[0])}&selected-env=${encodeURIComponent(environmentKeys[0])}`
                    : `${launchDarklyHost}/projects/${projectKey}/flags/${flagKey}/targeting`;

                return {
                    key: flagKey,
                    name: flagName,
                    description: flagDescription,
                    environments: environmentStates,
                    url: primaryUrl,
                    environmentUrls,
                };
            });

            // Build link to flags UI with query parameters
            const firstEnv = environmentKeys.length > 0 ? environmentKeys[0] : '';
            let flagsLink = `${launchDarklyHost}/projects/${projectKey}/flags`;
            if (firstEnv) {
                const params = new URLSearchParams({
                    env: firstEnv,
                    'selected-env': firstEnv,
                });
                if (filter) {
                    params.append('q', filter);
                }
                flagsLink = `${flagsLink}?${params.toString()}`;
            } else if (filter) {
                flagsLink = `${flagsLink}?q=${encodeURIComponent(filter)}`;
            }

            // Track the action
            runContext.context.trackAction({
                action: 'Listed feature flags',
                integration: IntegrationType.LAUNCHDARKLY,
                target: `Project: ${projectKey}`,
                details: `Retrieved ${formattedFlags.length} flags${filter ? ` filtered by: ${filter}` : ''}`,
                url: flagsLink,
                type: 'read',
                isReadOnly: true,
            });

            logger.info('[LaunchDarkly] listFeatureFlags - Success', {
                projectKey,
                totalFlags: formattedFlags.length,
                filteredCount: filteredFlags.length,
                originalCount: flags.length
            });

            return {
                success: true,
                projectKey,
                totalFlags: formattedFlags.length,
                flags: formattedFlags,
                flagsLink,
                message: `Found ${formattedFlags.length} feature flag(s) in project ${projectKey}. View all flags: ${flagsLink}`
            };
        } catch (error: any) {
            logger.error('[LaunchDarkly] listFeatureFlags - Error', {
                error: error,
                errorMessage: error?.message,
                errorStack: error?.stack,
                projectKey,
                summary,
                filter,
                tags
            });
            throw new Error(`Failed to list LaunchDarkly flags: ${error.message || 'Unknown error'}`);
        }
    },
});
