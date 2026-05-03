import { OutputConfigType } from "@prisma/client"
import { WebExtractConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { PrismaTransaction } from "../../types/prisma"
import { Output, ToolboxEntry } from "../abstract/Output"

import { webExtractTool } from "./tools/webExtractTool"

export class WebExtractOutput extends Output<WebExtractConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            {
                tool: webExtractTool,
                isReadOnly: true,
                integration: IntegrationType.TERSE,
                displayName: "Extract Page"
            }
        ]
        super(OutputConfigType.WEB_EXTRACT, toolbox)
    }

    async validateConfig(_output: WebExtractConfig, _userId: string): Promise<void> {}

    async addOutputToAgent(_tx: PrismaTransaction, _agentOutputId: string, _output: WebExtractConfig): Promise<void> {}

    protected getDummyConfigForCapability(): WebExtractConfig {
        return new WebExtractConfig()
    }

    protected getSystemInstructionsForConfigs(_configs: WebExtractConfig[]): string {
        return ""
    }
}
