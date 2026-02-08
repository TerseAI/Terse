import { Tool } from "@openai/agents"
import { webSearchTool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"

import { type CapabilityDescription, CapabilityRole, extractToolMetadata, getConfigMetadata } from "../../capabilityHelpers"
import { ConfigInstance } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { buildDummyOutputConfig } from "../../buildDummyConfigForCapability"
import { AgentOutputWithConfigs, PrismaTransaction } from "../../types/prisma"
import { convertOutputConfigTypeToConfigType } from "../../utility/typeConverters"
import { Output, ToolboxEntry } from "../abstract/Output"

export class TerseSkillsOutput extends Output<ConfigInstance> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            {
                tool: webSearchTool({
                    searchContextSize: "medium"
                }) as Tool,
                isReadOnly: true,
                integration: IntegrationType.TERSE,
                displayName: "Web Search"
            }
        ]
        super(OutputConfigType.TERSE, toolbox)
    }

    getCapabilityDescription(): CapabilityDescription {
        const configType = convertOutputConfigTypeToConfigType(OutputConfigType.TERSE)
        const meta = getConfigMetadata(configType)
        const tools = extractToolMetadata(this.toolbox)
        return {
            name: meta.name,
            description: meta.description,
            configType,
            integrationType: meta.integrationType,
            role: CapabilityRole.OUTPUT,
            tools,
            configFields: {},
            systemInstructions: ""
        }
    }

    async validateConfig(_output: ConfigInstance, _userId: string): Promise<void> {
        // No validation needed - this output has no config
    }

    async addOutputToAgent(_tx: PrismaTransaction, _agentOutputId: string, _output: ConfigInstance): Promise<void> {
        // No database records needed - this is always available
    }

    protected getDummyConfigForCapability(): AgentOutputWithConfigs {
        return buildDummyOutputConfig("example", { config_type: OutputConfigType.TERSE })
    }

    protected getSystemInstructionsForConfigs(_configs: AgentOutputWithConfigs[]): string {
        return ""
    }
}
