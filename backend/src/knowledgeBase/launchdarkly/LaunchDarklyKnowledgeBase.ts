import { Session } from "../../types/session";
import { AgentKnowledgeBaseWithConfigs, PrismaTransaction, User } from "../../types/prisma";
import { KnowledgeBaseConfigType } from "@prisma/client";
import { LaunchDarklyConfig } from "../../shared/Configs";
import { IntegrationType } from "../../shared/Integrations";
import { ToolboxEntry } from "../../outputs/abstract/Output";
import { KnowledgeBase } from "../abstract/KnowledgeBase";
import { Tool } from "@openai/agents";
import { listLaunchDarklyFlagsTool } from "./tools/listFeatureFlags";
import { getLaunchDarklyFlagDetailsTool } from "./tools/getFeatureFlagDetails";
import { db } from "../../prismaClient";
import logger from "../../logger";


/**
 * LaunchDarkly Knowledge Base implementation.
 * Provides tools for querying LaunchDarkly feature flags and their states.
 */
export class LaunchDarklyKnowledgeBase extends KnowledgeBase<LaunchDarklyConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: listLaunchDarklyFlagsTool as Tool, isReadOnly: true, integration: IntegrationType.LAUNCHDARKLY, displayName: 'List feature flags' },
            { tool: getLaunchDarklyFlagDetailsTool as Tool, isReadOnly: true, integration: IntegrationType.LAUNCHDARKLY, displayName: 'Get flag details' },
        ];

        super(KnowledgeBaseConfigType.LAUNCHDARKLY, toolbox);
    }


    async validateConfig(knowledgeBase: LaunchDarklyConfig, _userId: string): Promise<void> {
        if (!knowledgeBase.projectKey) {
            throw new Error('Invalid knowledge base config for launchdarkly: missing projectKey');
        }
        if (!knowledgeBase.environmentKeys || knowledgeBase.environmentKeys.length === 0) {
            throw new Error('Invalid knowledge base config for launchdarkly: requires at least one environment key');
        }
    }

    async addKnowledgeBaseToAgent(tx: PrismaTransaction, channelKnowledgeBaseId: string, knowledgeBase: LaunchDarklyConfig): Promise<void> {
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
    protected getSystemInstructionsForConfigs(configs: AgentKnowledgeBaseWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error('No LaunchDarkly KB configs provided');
        }
        
        const sections: string[] = [];

        // Header
        sections.push('=== LAUNCHDARKLY KNOWLEDGE BASE ===');
        
        // List all available configurations
        const configList: string[] = [];
        for (const config of configs) {
            if (!config.launchdarkly_config) {
                throw new Error('LaunchDarkly config not found');
            }
            const projectKey = config.launchdarkly_config.project_key;
            const environmentKeys = config.launchdarkly_config.environment_keys || [];
            configList.push(`  • Integration ID: ${config.integration_id} - Project: ${projectKey}, Environments: ${environmentKeys.join(', ')}`);
        }
        sections.push('Available configurations:');
        sections.push(configList.join('\n'));
        sections.push('\nWhen calling LaunchDarkly tools, you MUST include the `integrationId` parameter matching one of the integration IDs listed above.');

        // Usage strategy
        sections.push(`
WORKFLOW:
- Start with listLaunchDarklyFlags (summary=true) for quick overview
- Use getLaunchDarklyFlagDetails for specific flags needing deep-dive
- Set includeHistory=true when investigating timeline of changes

BEST PRACTICES:
- Always specify which environment you're referring to
- Link to LaunchDarkly UI for users to view/edit flags directly
- Clarify current state vs targeting rules when discussing flag behavior`);

        return sections.join('\n');
    }
}
