import { OutputConfigType } from "@prisma/client"
import { WebConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { PrismaTransaction } from "../../types/prisma"
import { Output } from "../abstract/Output"
import { unrestricted } from "../abstract/acl"

import { validateWebExtract, validateWebSearch } from "./tools/webAcl"
import { webExtractTool } from "./tools/webExtractTool"
import { webResearchTool } from "./tools/webResearchTool"
import { webSearchTool } from "./tools/webSearchTool"

export class WebOutput extends Output<WebConfig> {
    constructor() {
        super(OutputConfigType.WEB, [
            { tool: webSearchTool, isReadOnly: true, integration: IntegrationType.TERSE, displayName: "Web Search", validateACL: validateWebSearch },
            { tool: webExtractTool, isReadOnly: true, integration: IntegrationType.TERSE, displayName: "Extract Page", validateACL: validateWebExtract },
            { tool: webResearchTool, isReadOnly: true, integration: IntegrationType.TERSE, displayName: "Research", validateACL: unrestricted }
        ])
    }

    async validateConfig(_output: WebConfig, _userId: string): Promise<void> {}

    async addOutputToAgent(_tx: PrismaTransaction, _agentOutputId: string, _output: WebConfig): Promise<void> {}

    protected getSystemInstructionsForConfigs(configs: WebConfig[]): string {
        const allowedDomains = Array.from(new Set(configs.flatMap(c => c.allowedDomains ?? [])))
        if (allowedDomains.length === 0) {
            return ""
        }
        const domainList = allowedDomains.join(", ")
        return [
            `Web access is restricted to these domains (and their subdomains): ${domainList}.`,
            `Only call web_extract on URLs within those domains, and always pass include_domains to web_search restricted to them.`,
            `Requests to other domains will be blocked.`
        ].join(" ")
    }
}
