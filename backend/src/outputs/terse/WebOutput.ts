import { OutputConfigType } from "@prisma/client"
import { WebConfig } from "terse-types"
import { IntegrationType } from "terse-types"
import { ToolName } from "terse-types"

import { PrismaTransaction } from "../../types/prisma"
import { Output, ToolACLValidator, defineToolEntry } from "../abstract/Output"

import { webExtractTool } from "./tools/webExtractTool"
import { webResearchTool } from "./tools/webResearchTool"
import { webSearchTool } from "./tools/webSearchTool"

export class WebOutput extends Output<WebConfig> {
    constructor() {
        const t = defineToolEntry<WebConfig>()
        const toolbox = [
            t({ tool: webSearchTool, isReadOnly: true, integration: IntegrationType.TERSE, displayName: "Web Search", validateACL: validateWebSearch }),
            t({ tool: webExtractTool, isReadOnly: true, integration: IntegrationType.TERSE, displayName: "Extract Page", validateACL: validateWebExtract }),
            t({ tool: webResearchTool, isReadOnly: true, integration: IntegrationType.TERSE, displayName: "Research", validateACL: validateWebResearch })
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

type WebACL<TName extends ToolName> = ToolACLValidator<TName, WebConfig>

const validateWebSearch: WebACL<"web_search"> = _params => ({ ok: true as const })
const validateWebExtract: WebACL<"web_extract"> = _params => ({ ok: true as const })
const validateWebResearch: WebACL<"web_research"> = _params => ({ ok: true as const })
