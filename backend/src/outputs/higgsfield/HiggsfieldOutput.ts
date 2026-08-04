import { OutputConfigType } from "@prisma/client"
import { HiggsfieldOutputConfig, IntegrationType } from "terse-types"

import { HiggsfieldIntegrationManager } from "../../integrations/higgsfield/integration"
import { PrismaTransaction } from "../../types/prisma"
import { Output } from "../abstract/Output"
import { unrestricted } from "../abstract/acl"

import { higgsfieldGenerateImageTool } from "./tools/generateImage"

export class HiggsfieldOutput extends Output<HiggsfieldOutputConfig> {
    constructor() {
        super(OutputConfigType.HIGGSFIELD, [
            { tool: higgsfieldGenerateImageTool, isReadOnly: false, integration: IntegrationType.HIGGSFIELD, displayName: "Generate image", validateACL: unrestricted }
        ])
    }

    async validateConfig(output: HiggsfieldOutputConfig, _userId: string): Promise<void> {
        const manager = new HiggsfieldIntegrationManager()
        const instances = await manager.getAllActiveInstances()
        if (!instances.some(instance => instance.id === output.integrationId)) {
            throw new Error("Higgsfield integration not found. The integration may not be connected.")
        }
    }

    async addOutputToAgent(tx: PrismaTransaction, agentOutputId: string, _output: HiggsfieldOutputConfig): Promise<void> {
        await tx.automation_higgsfield_configs.create({ data: { automation_output_id: agentOutputId } })
    }

    protected getSystemInstructionsForConfigs(configs: HiggsfieldOutputConfig[]): string {
        if (configs.length === 0) {
            throw new Error("No Higgsfield configs provided")
        }

        const sections: string[] = []
        sections.push("=== HIGGSFIELD SKILL ===")
        sections.push("Available configurations:")
        configs.forEach(config => sections.push(`  • Integration ID: ${config.integrationId}`))
        sections.push("\nUse higgsfield_generate_image to produce ad creative from a text prompt. Include integrationId from a configured entry.")
        sections.push("Each generation costs Higgsfield credits, so do not regenerate speculatively. Set batchSize to 4 only when the user wants options to compare.")
        sections.push(
            "Returned URLs are Terse-hosted and signed for 24 hours. They are safe to show a human for approval and to pass to meta_ads_create_ad as pictureUrl. If a URL has gone stale, generate again rather than editing the URL."
        )
        sections.push("Pick a size that matches the placement: a landscape size such as 2048x1152 for feed ads, a portrait size such as 1152x2048 for stories and reels.")

        return sections.join("\n")
    }
}
