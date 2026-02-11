import { Tool } from "@openai/agents"
import { KnowledgeBaseConfigType } from "@prisma/client"

import { buildDummyKnowledgeBaseConfig } from "../../buildDummyConfigForCapability"
import { type CapabilityDescription, CapabilityRole, extractToolMetadata, getConfigMetadata } from "../../capabilityHelpers"
import { getLaunchDarklyAccessTokenOrThrow, validateLaunchDarklyEnvironmentsExist, validateLaunchDarklyProjectExists } from "../../integrations/LaunchDarklyIntegration"
import { ToolboxEntry } from "../../outputs/abstract/Output"
import { ConfigType, LaunchDarklyConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { AgentKnowledgeBaseWithConfigs, PrismaTransaction } from "../../types/prisma"
import { LaunchDarklyConfigSchema, stripConfigForValidation } from "../../utility/configSchemas"
import { KnowledgeBase } from "../abstract/KnowledgeBase"

import { getLaunchDarklyFlagDetailsTool } from "./tools/getFeatureFlagDetails"
import { listLaunchDarklyFlagsTool } from "./tools/listFeatureFlags"

/**
 * LaunchDarkly Knowledge Base implementation.
 * Provides tools for querying LaunchDarkly feature flags and their states.
 */
export class LaunchDarklyKnowledgeBase extends KnowledgeBase<LaunchDarklyConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: listLaunchDarklyFlagsTool as Tool, isReadOnly: true, integration: IntegrationType.LAUNCHDARKLY, displayName: "List feature flags" },
            { tool: getLaunchDarklyFlagDetailsTool as Tool, isReadOnly: true, integration: IntegrationType.LAUNCHDARKLY, displayName: "Get flag details" }
        ]

        super(KnowledgeBaseConfigType.LAUNCHDARKLY, toolbox)
    }

    getCapabilityDescription(): CapabilityDescription {
        const meta = getConfigMetadata(ConfigType.LAUNCHDARKLY)
        const tools = extractToolMetadata(this.toolbox)
        const systemInstructions = this.getSystemInstructions(true)

        return {
            name: meta.name,
            description: meta.description,
            configType: ConfigType.LAUNCHDARKLY,
            integrationType: meta.integrationType,
            role: CapabilityRole.KNOWLEDGE_BASE,
            tools,
            configFields: {
                integrationId: "LaunchDarkly integration connection",
                projectKey: "LaunchDarkly project key",
                environmentKeys: 'Array of environment keys (e.g. ["production", "staging"])'
            },
            systemInstructions
        }
    }

    protected getDummyConfigForCapability(): AgentKnowledgeBaseWithConfigs {
        return buildDummyKnowledgeBaseConfig("example", {
            config_type: KnowledgeBaseConfigType.LAUNCHDARKLY,
            launchdarkly_config: {
                project_key: "example-project",
                environment_keys: ["production"]
            }
        })
    }

    async validateConfig(knowledgeBase: LaunchDarklyConfig, _userId: string): Promise<void> {
        LaunchDarklyConfigSchema.parse(stripConfigForValidation(knowledgeBase))
        const apiKey = await getLaunchDarklyAccessTokenOrThrow(knowledgeBase.integrationId)
        await validateLaunchDarklyProjectExists(apiKey, knowledgeBase.projectKey)
        await validateLaunchDarklyEnvironmentsExist(apiKey, knowledgeBase.projectKey, knowledgeBase.environmentKeys)
    }

    async addKnowledgeBaseToAgent(tx: PrismaTransaction, channelKnowledgeBaseId: string, knowledgeBase: LaunchDarklyConfig): Promise<void> {
        await tx.automation_launchdarkly_configs.create({
            data: {
                automation_knowledge_base_id: channelKnowledgeBaseId,
                project_key: knowledgeBase.projectKey,
                environment_keys: knowledgeBase.environmentKeys
            }
        })
    }

    /**
     * Returns system instructions for LaunchDarkly knowledge base.
     * Provides guidance on how to use LaunchDarkly tools effectively.
     */
    protected getSystemInstructionsForConfigs(configs: AgentKnowledgeBaseWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error("No LaunchDarkly KB configs provided")
        }

        const sections: string[] = []

        // Header
        sections.push("=== LAUNCHDARKLY KNOWLEDGE BASE ===")

        // List all available configurations
        const configList: string[] = []
        for (const config of configs) {
            if (!config.launchdarkly_config) {
                throw new Error("LaunchDarkly config not found")
            }
            const projectKey = config.launchdarkly_config.project_key
            const environmentKeys = config.launchdarkly_config.environment_keys || []
            configList.push(`  • Integration ID: ${config.integration_id} - Project: ${projectKey}, Environments: ${environmentKeys.join(", ")}`)
        }
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        sections.push("\nWhen calling LaunchDarkly tools, you MUST include the `integrationId` parameter matching one of the integration IDs listed above.")

        // Usage strategy
        sections.push(`
WORKFLOW:
- Start with listLaunchDarklyFlags (summary=true) for quick overview
- Use getLaunchDarklyFlagDetails for specific flags needing deep-dive
- Set includeHistory=true when investigating timeline of changes

BEST PRACTICES:
- Always specify which environment you're referring to
- Link to LaunchDarkly UI for users to view/edit flags directly
- Clarify current state vs targeting rules when discussing flag behavior`)

        return sections.join("\n")
    }
}
