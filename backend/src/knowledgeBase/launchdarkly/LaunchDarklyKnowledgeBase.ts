import { Session } from "../../server";
import { ChannelKnowledgeBaseWithConfigs, PrismaTransaction, User } from "../../types/prisma";
import { KnowledgeBaseConfigType } from "@prisma/client";
import { LaunchDarklyConfig } from "../../shared/Configs";
import { IntegrationType } from "../../shared/Integrations";
import { ToolboxEntry } from "../../outputs/abstract/Output";
import { KnowledgeBase } from "../abstract/KnowledgeBase";
import { listLaunchDarklyFlagsTool } from "./tools/listFeatureFlags";
import { getLaunchDarklyFlagDetailsTool } from "./tools/getFeatureFlagDetails";
import { db } from "../../prismaClient";
import logger from "../../logger";

/**
 * Session type for LaunchDarkly knowledge base.
 * Extends the base Session with LaunchDarkly-specific configuration.
 */
export interface LaunchDarklyKnowledgeBaseSession extends Session {
    launchDarklyConfig: LaunchDarklyConfig;
}

/**
 * LaunchDarkly Knowledge Base implementation.
 * Provides tools for querying LaunchDarkly feature flags and their states.
 */
export class LaunchDarklyKnowledgeBase extends KnowledgeBase<LaunchDarklyKnowledgeBaseSession, LaunchDarklyConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            {
                tool: listLaunchDarklyFlagsTool,
                isReadOnly: true,
                integration: IntegrationType.LAUNCHDARKLY
            },
            {
                tool: getLaunchDarklyFlagDetailsTool,
                isReadOnly: true,
                integration: IntegrationType.LAUNCHDARKLY
            }
        ];

        super(KnowledgeBaseConfigType.LAUNCHDARKLY, toolbox);
    }

    /**
     * Creates a LaunchDarkly knowledge base session from the configuration.
     * Loads the LaunchDarkly integration and configures the session with credentials.
     */
    async createSessionFromConfig(
        integrationId: string,
        channelKnowledgeBase: ChannelKnowledgeBaseWithConfigs,
        user: User
    ): Promise<LaunchDarklyKnowledgeBaseSession> {
        // Load the LaunchDarkly integration
        const integration = await db().launchdarkly_integrations.findUnique({
            where: { id: integrationId },
        });

        if (!integration) {
            throw new Error(`LaunchDarkly integration not found: ${integrationId}`);
        }

        // Load the LaunchDarkly config from the channel knowledge base
        if (!channelKnowledgeBase.launchdarkly_config) {
            throw new Error('LaunchDarkly config not found in channel knowledge base');
        }

        const launchdarklyConfig = channelKnowledgeBase.launchdarkly_config;

        // Create the LaunchDarkly config instance
        const config = new LaunchDarklyConfig(
            integrationId,
            launchdarklyConfig.project_key,
            launchdarklyConfig.environment_keys
        );

        // Verify that the config is complete
        if (!config.isComplete()) {
            logger.warn('LaunchDarkly knowledge base configured but config is incomplete', {
                integrationId,
                projectKey: config.projectKey,
                environmentKeys: config.environmentKeys
            });
        }

        // Create the session with LaunchDarkly config
        const session: LaunchDarklyKnowledgeBaseSession = {
            user,
            isUserInitiated: true,
            launchDarklyConfig: config,
        };

        return session;
    }

    async validateConfig(knowledgeBase: LaunchDarklyConfig, _userId: string): Promise<void> {
        if (!knowledgeBase.projectKey) {
            throw new Error('Invalid knowledge base config for launchdarkly: missing projectKey');
        }
        if (!knowledgeBase.environmentKeys || knowledgeBase.environmentKeys.length === 0) {
            throw new Error('Invalid knowledge base config for launchdarkly: requires at least one environment key');
        }
    }

    async addKnowledgeBaseToChannel(tx: PrismaTransaction, channelKnowledgeBaseId: string, knowledgeBase: LaunchDarklyConfig): Promise<void> {
        await tx.automation_launchdarkly_configs.create({
            data: {
                automation_knowledge_base_id: channelKnowledgeBaseId,
                project_key: knowledgeBase.projectKey,
                environment_keys: knowledgeBase.environmentKeys,
            }
        });
    }

    /**
     * Returns system instructions for LaunchDarkly knowledge base.
     * Provides guidance on how to use LaunchDarkly tools effectively.
     */
    getSystemInstructions(session: LaunchDarklyKnowledgeBaseSession): string {
        const { launchDarklyConfig } = session;
        const sections: string[] = [];

        // Header
        sections.push('=== LAUNCHDARKLY KNOWLEDGE BASE ===');
        sections.push(`Project: ${launchDarklyConfig.projectKey}`);
        sections.push(`Environments: ${launchDarklyConfig.environmentKeys.join(', ')}`);

        // Available tools section
        sections.push(`
AVAILABLE TOOLS:
- listLaunchDarklyFlags: List all feature flags with their on/off state per environment.
  Use summary=true for quick overview, summary=false for full details.

- getLaunchDarklyFlagDetails: Get detailed information about a specific flag including
  targeting rules, rollout strategies, and variations.
  Set includeHistory=true with optional before/after dates to also get change history over a time window.

USAGE GUIDELINES:
1. START WITH OVERVIEW:
   - Use listLaunchDarklyFlags with summary=true to get a quick view of all flags
   - This shows which flags are enabled/disabled in each environment

2. INVESTIGATE SPECIFIC FLAGS:
   - Use getLaunchDarklyFlagDetails for deep-dive on specific flags
   - Check targeting rules and rollout strategies when debugging issues
   - Set includeHistory=true to see recent changes over a time window

3. ANSWERING COMMON QUESTIONS:
   - "Is flag X enabled in production?" → listLaunchDarklyFlags or getLaunchDarklyFlagDetails
   - "What flags are enabled in staging?" → listLaunchDarklyFlags with filter
   - "Show me all flags with tag Y" → listLaunchDarklyFlags with tags filter
   - "When was flag X enabled?" → getLaunchDarklyFlagDetails with includeHistory=true
   - "What changes were made to flag X last week?" → getLaunchDarklyFlagDetails with includeHistory=true and after date

4. BEST PRACTICES:
   - Always specify which environment you're referring to (production, staging, etc.)
   - Link to the LaunchDarkly UI for users to view/edit flags directly
   - When discussing flag state, clarify if you're talking about current state vs targeting rules
   - Use includeHistory=true to understand the timeline of changes when investigating issues`);

        return sections.join('\n');
    }
}
