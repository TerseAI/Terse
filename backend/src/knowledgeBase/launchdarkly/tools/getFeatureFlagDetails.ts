import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import logger from "../../../logger";
import { db } from "../../../prismaClient";
import { LaunchDarklyConfig } from "../../../shared/Configs";
import { IntegrationType } from "../../../shared/Integrations";

/**
 * Tool for getting detailed information about a specific LaunchDarkly feature flag.
 */
export const getLaunchDarklyFlagDetailsTool = tool({
    name: 'getLaunchDarklyFlagDetails',
    description: 'Get detailed information about a specific feature flag, including targeting rules, rollout strategies, and variations. Returns flag metadata and per-environment configuration (on state, targeting rules, fallthrough strategy, off variation).',
    parameters: z.object({
        flagKey: z.string().describe('The flag key to retrieve.'),
        environmentKey: z.union([z.string(), z.null()]).optional().describe('Optional: Specific environment to get details for (if not provided, returns all configured environments).'),
    }),
    execute: async ({ flagKey, environmentKey }, runContext?: RunContext<any>) => {
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
        const environmentKeys = environmentKey ? [environmentKey] : launchDarklyConfig.environmentKeys;
        const launchDarklyHost = 'https://app.launchdarkly.com';

        try {
            logger.info('Getting LaunchDarkly flag details', { projectKey, flagKey, environmentKey });

            // Call LaunchDarkly API
            const flagUrl = `${launchDarklyHost}/api/v2/flags/${projectKey}/${flagKey}`;
            
            const response = await fetch(flagUrl, {
                method: 'GET',
                headers: {
                    'Authorization': apiKey,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error('LaunchDarkly flag details API error', {
                    status: response.status,
                    error: errorText,
                    projectKey,
                    flagKey
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
            for (const envKey of environmentKeys) {
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

            const flagUrl_ui = `${launchDarklyHost}/${projectKey}/flags/${flagKey}`;

            // Track the action
            runContext.context.trackAction({
                action: 'Retrieved flag details',
                integration: IntegrationType.LAUNCHDARKLY,
                target: flagKey,
                details: `Retrieved details for flag "${flagKey}" in project ${projectKey}`,
                url: flagUrl_ui,
                type: 'read',
                isReadOnly: true,
            });

            return {
                success: true,
                projectKey,
                flag: flagMetadata,
                environments,
                url: flagUrl_ui,
                message: `Retrieved details for flag "${flagKey}" in project ${projectKey}. View flag: ${flagUrl_ui}`
            };
        } catch (error: any) {
            logger.error('Error getting LaunchDarkly flag details', { error, projectKey, flagKey });
            throw new Error(`Failed to get LaunchDarkly flag details: ${error.message || 'Unknown error'}`);
        }
    },
});
