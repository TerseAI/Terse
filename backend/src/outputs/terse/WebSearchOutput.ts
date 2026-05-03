import { OutputConfigType } from "@prisma/client"
import { WebSearchConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { PrismaTransaction } from "../../types/prisma"
import { Output, ToolboxEntry } from "../abstract/Output"

import { runHistoryWebSearchTool } from "./tools/webSearchTool"

export class WebSearchOutput extends Output<WebSearchConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            {
                tool: runHistoryWebSearchTool,
                isReadOnly: true,
                integration: IntegrationType.TERSE,
                displayName: "Web Search"
            }
        ]
        super(OutputConfigType.WEB_SEARCH, toolbox)
    }

    async validateConfig(_output: WebSearchConfig, _userId: string): Promise<void> {}

    async addOutputToAgent(_tx: PrismaTransaction, _agentOutputId: string, _output: WebSearchConfig): Promise<void> {}

    protected getDummyConfigForCapability(): WebSearchConfig {
        return new WebSearchConfig()
    }

    protected getSystemInstructionsForConfigs(_configs: WebSearchConfig[]): string {
        return ""
    }
}
