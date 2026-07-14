import { OutputConfigType } from "@prisma/client"
import { IntegrationType, ResendOutputConfig } from "terse-types"

import { PrismaTransaction } from "../../types/prisma"
import { Output } from "../abstract/Output"
import { unrestricted } from "../abstract/acl"

import { resendSendTemplateTool } from "./tools/sendTemplate"

export class ResendOutput extends Output<ResendOutputConfig> {
    constructor() {
        super(OutputConfigType.RESEND, [
            { tool: resendSendTemplateTool, isReadOnly: false, integration: IntegrationType.RESEND, displayName: "Send template", supportsApproval: true, validateACL: unrestricted }
        ])
    }

    async validateConfig(_output: ResendOutputConfig, _userId: string): Promise<void> {}

    async addOutputToAgent(tx: PrismaTransaction, automationOutputId: string, _output: ResendOutputConfig): Promise<void> {
        await tx.automation_resend_output_configs.create({ data: { automation_output_id: automationOutputId } })
    }

    protected getSystemInstructionsForConfigs(configs: ResendOutputConfig[]): string {
        if (configs.length === 0) throw new Error("No Resend output configs provided")
        return [
            "=== RESEND OUTPUT ===",
            "Send email only through published templates. Use the generated template constants and provide every required variable without a fallback.",
            "Available configurations:",
            ...configs.map(config => `  • Integration ID: ${config.integrationId}`)
        ].join("\n")
    }
}
