import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"
import { LaunchDarklyConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { getLaunchDarklyAccessTokenOrThrow, validateLaunchDarklyEnvironmentsExist, validateLaunchDarklyProjectExists } from "../../integrations/LaunchDarklyIntegration"
import { PrismaTransaction } from "../../types/prisma"
import { Output, ToolboxEntry } from "../abstract/Output"

import { getLaunchDarklyFlagDetailsTool } from "./tools/getFeatureFlagDetails"
import { listLaunchDarklyFlagsTool } from "./tools/listFeatureFlags"

export class LaunchDarklySkillOutput extends Output<LaunchDarklyConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: listLaunchDarklyFlagsTool, isReadOnly: true, integration: IntegrationType.LAUNCHDARKLY, displayName: "List feature flags" },
            { tool: getLaunchDarklyFlagDetailsTool, isReadOnly: true, integration: IntegrationType.LAUNCHDARKLY, displayName: "Get flag details" }
        ]

        super(OutputConfigType.LAUNCHDARKLY, toolbox)
    }

    protected getDummyConfigForCapability(): LaunchDarklyConfig {
        return new LaunchDarklyConfig("example", "example-project", ["production"])
    }

    async validateConfig(output: LaunchDarklyConfig, _userId: string): Promise<void> {
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

    protected getSystemInstructionsForConfigs(configs: LaunchDarklyConfig[]): string {
        if (configs.length === 0) {
            throw new Error("No LaunchDarkly skill configs provided")
        }

        const sections: string[] = []
        sections.push("=== LAUNCHDARKLY SKILL (READ-ONLY) ===")
        sections.push("Available configurations:")

        for (const config of configs) {
            sections.push(`  • Integration ID: ${config.integrationId} - Project: ${config.projectKey}, Environments: ${(config.environmentKeys || []).join(", ")}`)
        }

        sections.push("\nWhen calling LaunchDarkly tools, include integrationId, projectKey, and environmentKeys from a configured entry.")
        sections.push("Tools: listLaunchDarklyFlags, getLaunchDarklyFlagDetails")
        sections.push("Use these tools for feature-flag analysis and cleanup recommendations; they are read-only.")

        return sections.join("\n")
    }
}
