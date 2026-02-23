import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"

import { buildDummyOutputConfig } from "../../buildDummyConfigForCapability"
import { type CapabilityDescription, CapabilityRole, extractToolMetadata, getConfigMetadata } from "../../capabilityHelpers"
import { Output, ToolboxEntry } from "../../outputs/abstract/Output"
import { ConfigType, WorkOSOutputConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { AgentOutputWithConfigs, PrismaTransaction } from "../../types/prisma"
import { WorkOSOutputConfigSchema, stripConfigForValidation } from "../../utility/configSchemas"

import { getWorkOSUserTool } from "./tools/getUser"
import { listWorkOSUsersTool } from "./tools/listUsers"

export class WorkOSOutput extends Output<WorkOSOutputConfig> {
    constructor(readOnly: boolean) {
        const toolbox: ToolboxEntry[] = [
            { tool: listWorkOSUsersTool as Tool, isReadOnly: true, integration: IntegrationType.WORKOS, displayName: "List users" },
            { tool: getWorkOSUserTool as Tool, isReadOnly: true, integration: IntegrationType.WORKOS, displayName: "Get user" }
        ]

        super(OutputConfigType.WORKOS, toolbox, readOnly)
    }

    getCapabilityDescription(): CapabilityDescription {
        const meta = getConfigMetadata(ConfigType.WORKOS_OUTPUT)
        const tools = extractToolMetadata(this.toolbox)
        const systemInstructions = this.getSystemInstructions(true)

        return {
            name: meta.name,
            description: meta.description,
            configType: ConfigType.WORKOS_OUTPUT,
            integrationType: meta.integrationType,
            role: CapabilityRole.OUTPUT,
            tools,
            configFields: {
                integrationId: "WorkOS integration connection"
            },
            systemInstructions
        }
    }

    protected getDummyConfigForCapability(): AgentOutputWithConfigs {
        return buildDummyOutputConfig("example", {
            config_type: OutputConfigType.WORKOS
        })
    }

    async validateConfig(output: WorkOSOutputConfig, _userId: string): Promise<void> {
        WorkOSOutputConfigSchema.parse(stripConfigForValidation(output))
    }

    async addOutputToAgent(tx: PrismaTransaction, channelOutputId: string, _output: WorkOSOutputConfig): Promise<void> {
        await tx.automation_workos_output_configs.create({
            data: {
                automation_output_id: channelOutputId
            }
        })
    }

    protected getSystemInstructionsForConfigs(configs: AgentOutputWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error("No WorkOS output configs provided")
        }

        const sections: string[] = []

        sections.push("=== WORKOS OUTPUT ===")

        const configList: string[] = []
        for (const config of configs) {
            configList.push(`  • Integration ID: ${config.integration_id}`)
        }
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        sections.push("\nWhen calling WorkOS tools, you MUST include the `integrationId` parameter matching one of the integration IDs listed above.")

        return sections.join("\n")
    }
}
