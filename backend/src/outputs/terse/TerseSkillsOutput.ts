import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"

import { ConfigInstance, TerseConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { PrismaTransaction } from "../../types/prisma"
import { Output, ToolboxEntry } from "../abstract/Output"

import { imageEditTool } from "./tools/editImage"
import { webExtractTool } from "./tools/webExtractTool"
import { webResearchTool } from "./tools/webResearchTool"
import { webSearchTool } from "./tools/webSearchTool"

export class TerseSkillsOutput extends Output<ConfigInstance> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            {
                tool: webSearchTool,
                isReadOnly: true,
                integration: IntegrationType.TERSE,
                displayName: "Web Search"
            },
            {
                tool: webExtractTool,
                isReadOnly: true,
                integration: IntegrationType.TERSE,
                displayName: "Extract Page"
            },
            {
                tool: webResearchTool,
                isReadOnly: true,
                integration: IntegrationType.TERSE,
                displayName: "Research"
            },
            {
                tool: imageEditTool,
                isReadOnly: true,
                integration: IntegrationType.TERSE,
                displayName: "Edit Image"
            }
        ]
        super(OutputConfigType.TERSE, toolbox)
    }

    async validateConfig(_output: ConfigInstance, _userId: string): Promise<void> {
        // No validation needed - this output has no config
    }

    async addOutputToAgent(_tx: PrismaTransaction, _agentOutputId: string, _output: ConfigInstance): Promise<void> {
        // No database records needed - this is always available
    }

    protected getDummyConfigForCapability(): ConfigInstance {
        return new TerseConfig()
    }

    protected getSystemInstructionsForConfigs(_configs: ConfigInstance[]): string {
        return ""
    }
}
