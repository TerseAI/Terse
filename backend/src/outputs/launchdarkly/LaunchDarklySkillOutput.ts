import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"

import { buildDummyOutputConfig } from "../../buildDummyConfigForCapability"
import { type CapabilityDescription, CapabilityRole, extractToolMetadata, getConfigMetadata } from "../../capabilityHelpers"
import { getLaunchDarklyAccessTokenOrThrow, validateLaunchDarklyEnvironmentsExist, validateLaunchDarklyProjectExists } from "../../integrations/LaunchDarklyIntegration"
import { LaunchDarklyConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { AgentOutputWithConfigs, PrismaTransaction } from "../../types/prisma"
import { LaunchDarklyConfigSchema, stripConfigForValidation } from "../../utility/configSchemas"
import { convertOutputConfigTypeToConfigType } from "../../utility/typeConverters"
import { Output, ToolboxEntry } from "../abstract/Output"
import { getLaunchDarklyFlagDetailsTool } from "./tools/getFeatureFlagDetails"
import { listLaunchDarklyFlagsTool } from "./tools/listFeatureFlags"

export class LaunchDarklySkillOutput extends Output<LaunchDarklyConfig> {
    constructor(readOnly = false) {
        const toolbox: ToolboxEntry[] = [
            { tool: listLaunchDarklyFlagsTool as Tool, isReadOnly: true, integration: IntegrationType.LAUNCHDARKLY, displayName: "List feature flags" },
            { tool: getLaunchDarklyFlagDetailsTool as Tool, isReadOnly: true, integration: IntegrationType.LAUNCHDARKLY, displayName: "Get flag details" }
        ]

        super(OutputConfigType.LAUNCHDARKLY, toolbox, readOnly)
    }

    getCapabilityDescription(): CapabilityDescription {
        const configType = convertOutputConfigTypeToConfigType(OutputConfigType.LAUNCHDARKLY)
        const meta = getConfigMetadata(configType)
        const tools = extractToolMetadata(this.toolbox)
        const systemInstructions = this.getSystemInstructions(true)

        return {
            name: meta.name,
            description: meta.description,
            configType,
            integrationType: meta.integrationType,
            role: CapabilityRole.OUTPUT,
            tools,
            configFields: {
                integrationId: "LaunchDarkly integration connection",
                projectKey: "LaunchDarkly project key",
                environmentKeys: "Array of LaunchDarkly environment keys"
            },
            systemInstructions
        }
    }

    protected getDummyConfigForCapability(): AgentOutputWithConfigs {
        return buildDummyOutputConfig("example", {
            config_type: OutputConfigType.LAUNCHDARKLY,
            launchdarkly_config: {
                project_key: "example-project",
                environment_keys: ["production"]
            }
        })
    }

    async validateConfig(output: LaunchDarklyConfig, _userId: string): Promise<void> {
        LaunchDarklyConfigSchema.parse(stripConfigForValidation(output))
        const apiKey = await getLaunchDarklyAccessTokenOrThrow(output.integrationId)
        await validateLaunchDarklyProjectExists(apiKey, output.projectKey)
        await validateLaunchDarklyEnvironmentsExist(apiKey, output.projectKey, output.environmentKeys)
    }

    async addOutputToAgent(tx: PrismaTransaction, agentOutputId: string, output: LaunchDarklyConfig): Promise<void> {
        await tx.automation_launchdarkly_configs.create({
            data: {
                automation_output_id: agentOutputId,
                project_key: output.projectKey,
                environment_keys: output.environmentKeys
            }
        })
    }

    protected getSystemInstructionsForConfigs(configs: AgentOutputWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error("No LaunchDarkly skill configs provided")
        }

        const sections: string[] = []
        sections.push("=== LAUNCHDARKLY SKILL (READ-ONLY) ===")
        sections.push("Available configurations:")

        for (const config of configs) {
            if (!config.launchdarkly_config) {
                throw new Error("LaunchDarkly config not found")
            }
            sections.push(
                `  • Integration ID: ${config.integration_id} - Project: ${config.launchdarkly_config.project_key}, Environments: ${(config.launchdarkly_config.environment_keys || []).join(", ")}`
            )
        }

        sections.push("\nWhen calling LaunchDarkly tools, include integrationId, projectKey, and environmentKeys from a configured entry.")
        sections.push("Tools: listLaunchDarklyFlags, getLaunchDarklyFlagDetails")
        sections.push("Use these tools for feature-flag analysis and cleanup recommendations; they are read-only.")

        return sections.join("\n")
    }
}
