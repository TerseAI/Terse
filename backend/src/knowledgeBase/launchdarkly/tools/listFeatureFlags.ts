import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import logger from "../../../logger";
import { db } from "../../../prismaClient";
import { LaunchDarklyConfig } from "../../../shared/Configs";
import { IntegrationType } from "../../../shared/Integrations";

/**
 * Tool for listing LaunchDarkly feature flags with their enabled/disabled states per environment.
 */
export const listLaunchDarklyFlagsTool = tool({
    name: 'listLaunchDarklyFlags',
    description: 'List all feature flags for the configured project with their enabled/disabled states per environment. Returns flag key, name, and on/off state for each configured environment. Use summary=true for quick overview, summary=false for full details.',
    parameters: z.object({
        summary: z.boolean().default(true).describe('If true, return only flag key, name, and on/off state per environment. If false, return full flag details.'),
        filter: z.union([z.string(), z.null()]).optional().describe('Optional: Filter flags by name/key containing this text.'),
        tags: z.union([z.array(z.string()), z.null()]).optional().describe('Optional: Filter flags by tags.'),
    }),
    execute: async ({ summary = true, filter, tags }, runContext?: RunContext<any>) => {
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
        const environmentKeys = launchDarklyConfig.environmentKeys;
        const launchDarklyHost = 'https://app.launchdarkly.com';

        try {
            logger.info('Listing LaunchDarkly flags', { projectKey, summary, filter, tags });

            // Build query parameters
            const params = new URLSearchParams({
                summary: summary.toString(),
            });

            // Call LaunchDarkly API
            const flagsUrl = `${launchDarklyHost}/api/v2/flags/${projectKey}?${params.toString()}`;
            
            const response = await fetch(flagsUrl, {
                method: 'GET',
                headers: {
                    'Authorization': apiKey,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error('LaunchDarkly flags API error', {
                    status: response.status,
                    error: errorText,
                    projectKey
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
            
            // Extract flags from response (could be array or object with items property)
            const flags = Array.isArray(flagsData) 
                ? flagsData 
                : (flagsData.items || flagsData.flags || []);

            // Apply filters
            let filteredFlags = flags;
            if (filter) {
                const filterLower = filter.toLowerCase();
                filteredFlags = filteredFlags.filter((flag: any) => 
                    (flag.key && flag.key.toLowerCase().includes(filterLower)) ||
                    (flag.name && flag.name.toLowerCase().includes(filterLower))
                );
            }
            if (tags && tags.length > 0) {
                filteredFlags = filteredFlags.filter((flag: any) => {
                    const flagTags = flag.tags || [];
                    return tags.some(tag => flagTags.includes(tag));
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

                return {
                    key: flagKey,
                    name: flagName,
                    description: flagDescription,
                    environments: environmentStates,
                    url: `${launchDarklyHost}/${projectKey}/flags/${flagKey}`,
                };
            });

            // Build link to flags UI
            const flagsLink = `${launchDarklyHost}/${projectKey}/flags`;

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

            return {
                success: true,
                projectKey,
                totalFlags: formattedFlags.length,
                flags: formattedFlags,
                flagsLink,
                message: `Found ${formattedFlags.length} feature flag(s) in project ${projectKey}. View all flags: ${flagsLink}`
            };
        } catch (error: any) {
            logger.error('Error listing LaunchDarkly flags', { error, projectKey });
            throw new Error(`Failed to list LaunchDarkly flags: ${error.message || 'Unknown error'}`);
        }
    },
});
