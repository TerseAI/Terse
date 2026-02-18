import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"

import { buildDummyOutputConfig } from "../../buildDummyConfigForCapability"
import { type CapabilityDescription, CapabilityRole, extractToolMetadata, getConfigMetadata } from "../../capabilityHelpers"
import { validatePosthogProjectExists } from "../../integrations/PosthogIntegration"
import { searchEventsTool } from "../../knowledgeBase/posthog/tools/searchEvents"
import { getSessionEventsTool } from "../../knowledgeBase/posthog/tools/getSessionEvents"
import { searchLogsTool } from "../../knowledgeBase/posthog/tools/searchLogs"
import { searchSessionsTool } from "../../knowledgeBase/posthog/tools/searchSessions"
import { PosthogConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { AgentOutputWithConfigs, PrismaTransaction } from "../../types/prisma"
import { PosthogConfigSchema, stripConfigForValidation } from "../../utility/configSchemas"
import { convertOutputConfigTypeToConfigType } from "../../utility/typeConverters"
import { Output, ToolboxEntry } from "../abstract/Output"

export class PosthogSkillOutput extends Output<PosthogConfig> {
    constructor(readOnly = false) {
        const toolbox: ToolboxEntry[] = [
            { tool: searchLogsTool as Tool, isReadOnly: true, integration: IntegrationType.POSTHOG, displayName: "Search logs" },
            { tool: searchSessionsTool as Tool, isReadOnly: true, integration: IntegrationType.POSTHOG, displayName: "Search sessions" },
            { tool: getSessionEventsTool as Tool, isReadOnly: true, integration: IntegrationType.POSTHOG, displayName: "Get session events" },
            { tool: searchEventsTool as Tool, isReadOnly: true, integration: IntegrationType.POSTHOG, displayName: "Search events" }
        ]

        super(OutputConfigType.POSTHOG, toolbox, readOnly)
    }

    getCapabilityDescription(): CapabilityDescription {
        const configType = convertOutputConfigTypeToConfigType(OutputConfigType.POSTHOG)
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
                integrationId: "PostHog integration connection",
                projectId: "PostHog project ID",
                projectName: "Project display name"
            },
            systemInstructions
        }
    }

    protected getDummyConfigForCapability(): AgentOutputWithConfigs {
        return buildDummyOutputConfig("example", {
            config_type: OutputConfigType.POSTHOG,
            posthog_config: {
                project_id: "example-project",
                project_name: "Example Project"
            }
        })
    }

    async validateConfig(output: PosthogConfig, _userId: string): Promise<void> {
        PosthogConfigSchema.parse(stripConfigForValidation(output))
        await validatePosthogProjectExists(output.integrationId, output.projectId)
    }

    async addOutputToAgent(tx: PrismaTransaction, agentOutputId: string, output: PosthogConfig): Promise<void> {
        await tx.automation_posthog_configs.create({
            data: {
                automation_output_id: agentOutputId,
                project_id: output.projectId,
                project_name: output.projectName || null
            }
        })
    }

    protected getSystemInstructionsForConfigs(configs: AgentOutputWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error("No PostHog skill configs provided")
        }

        const sections: string[] = []
        sections.push("=== POSTHOG SKILL (READ-ONLY) ===")
        sections.push("Available configurations:")

        for (const config of configs) {
            if (!config.posthog_config) {
                throw new Error("PostHog config not found")
            }
            sections.push(
                `  • Integration ID: ${config.integration_id} - Project Name: ${config.posthog_config.project_name || "N/A"}, Project ID: ${config.posthog_config.project_id || "N/A"}`
            )
        }

        sections.push("\nWhen calling PostHog tools, include integrationId and projectId from a configured entry.")
        sections.push("Tools: searchPosthogLogs, searchPosthogSessions, getPosthogSessionEvents, searchPosthogEvents")
        sections.push("Use these tools for investigation and evidence gathering; they are read-only.")

        return sections.join("\n")
    }
}

