import { OutputConfigType } from "@prisma/client"
import { WebConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { PrismaTransaction } from "../../types/prisma"
import { Output } from "../abstract/Output"
import { unrestricted } from "../abstract/acl"

import { webExtractTool } from "./tools/webExtractTool"
import { webResearchTool } from "./tools/webResearchTool"
import { webSearchTool } from "./tools/webSearchTool"

export class WebOutput extends Output<WebConfig> {
    constructor() {
        super(OutputConfigType.WEB, [
            { tool: webSearchTool, isReadOnly: true, integration: IntegrationType.TERSE, displayName: "Web Search", validateACL: unrestricted },
            { tool: webExtractTool, isReadOnly: true, integration: IntegrationType.TERSE, displayName: "Extract Page", validateACL: unrestricted },
            { tool: webResearchTool, isReadOnly: true, integration: IntegrationType.TERSE, displayName: "Research", validateACL: unrestricted }
        ])
    }

    async validateConfig(_output: WebConfig, _userId: string): Promise<void> {}

    async addOutputToAgent(_tx: PrismaTransaction, _agentOutputId: string, _output: WebConfig): Promise<void> {}

    protected getSystemInstructionsForConfigs(_configs: WebConfig[]): string {
        return ""
    }
}
