import { OutputConfigType } from "@prisma/client"
import { WebConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { PrismaTransaction } from "../../types/prisma"
import { defineToolboxEntry, Output } from "../abstract/Output"

import { validateWebCapabilityACL } from "./acl"
import { webExtractTool } from "./tools/webExtractTool"
import { webResearchTool } from "./tools/webResearchTool"
import { runHistoryWebSearchTool } from "./tools/webSearchTool"

export class WebOutput extends Output<WebConfig> {
    constructor() {
        const toolbox = [
            defineToolboxEntry({
                tool: runHistoryWebSearchTool,
                isReadOnly: true,
                integration: IntegrationType.TERSE,
                displayName: "Web Search",
                validateACL: validateWebCapabilityACL
            }),
            defineToolboxEntry({
                tool: webExtractTool,
                isReadOnly: true,
                integration: IntegrationType.TERSE,
                displayName: "Extract Page",
                validateACL: validateWebCapabilityACL
            }),
            defineToolboxEntry({
                tool: webResearchTool,
                isReadOnly: true,
                integration: IntegrationType.TERSE,
                displayName: "Research",
                validateACL: validateWebCapabilityACL
            })
        ]
        super(OutputConfigType.WEB, toolbox)
    }

    async validateConfig(_output: WebConfig, _userId: string): Promise<void> {}

    async addOutputToAgent(_tx: PrismaTransaction, _agentOutputId: string, _output: WebConfig): Promise<void> {}

    protected getDummyConfigForCapability(): WebConfig {
        return new WebConfig()
    }

    protected getSystemInstructionsForConfigs(_configs: WebConfig[]): string {
        return ""
    }
}
