import { OutputConfigType } from "@prisma/client"
import { WebResearchConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { PrismaTransaction } from "../../types/prisma"
import { Output, ToolboxEntry } from "../abstract/Output"

import { webResearchTool } from "./tools/webResearchTool"

export class WebResearchOutput extends Output<WebResearchConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            {
                tool: webResearchTool,
                isReadOnly: true,
                integration: IntegrationType.TERSE,
                displayName: "Research"
            }
        ]
        super(OutputConfigType.WEB_RESEARCH, toolbox)
    }

    async validateConfig(_output: WebResearchConfig, _userId: string): Promise<void> {}

    async addOutputToAgent(_tx: PrismaTransaction, _agentOutputId: string, _output: WebResearchConfig): Promise<void> {}

    protected getDummyConfigForCapability(): WebResearchConfig {
        return new WebResearchConfig()
    }

    protected getSystemInstructionsForConfigs(_configs: WebResearchConfig[]): string {
        return ""
    }
}
