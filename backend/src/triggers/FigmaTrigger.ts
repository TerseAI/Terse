import chalk from "chalk"

import { CapabilityDescription, CapabilityRole, getConfigMetadata } from "../capabilityHelpers"
import { FigmaIntegrationManager, validateFigmaFileExists } from "../integrations/FigmaIntegration"
import { SlackIntegrationManager } from "../integrations/SlackIntegration"
import { ConfigType, FigmaConfig } from "../shared/Configs"
import { PrismaTransaction } from "../types/prisma"
import { FigmaConfigSchema, stripConfigForValidation } from "../utility/configSchemas"

import { Trigger } from "./Trigger"

export class FigmaTrigger implements Trigger<FigmaConfig> {
    integrationManager: FigmaIntegrationManager
    configType: ConfigType = ConfigType.FIGMA

    constructor() {
        this.integrationManager = new FigmaIntegrationManager()
    }

    getCapabilityDescription(): CapabilityDescription {
        const meta = getConfigMetadata(ConfigType.FIGMA)
        return {
            name: meta.name,
            description: meta.description,
            configType: ConfigType.FIGMA,
            integrationType: meta.integrationType,
            role: CapabilityRole.TRIGGER,
            tools: [],
            configFields: {
                integrationId: "<integrationId>",
                fileKey: "Figma file key (from fetchResourcesForIntegration)",
                fileName: "Figma file display name",
                teamId: "Figma team ID (required for webhook creation)"
            },
            systemInstructions: ""
        }
    }

    async validateConfig(trigger: FigmaConfig, _userId: string): Promise<void> {
        FigmaConfigSchema.parse(stripConfigForValidation(trigger))
        await validateFigmaFileExists(trigger.integrationId, trigger.fileKey)
    }

    async addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, trigger: FigmaConfig): Promise<void> {
        await tx.automation_figma_configs.create({
            data: {
                automation_input_id: agentTriggerId,
                file_key: trigger.fileKey,
                file_name: trigger.fileName,
                team_id: trigger.teamId
            }
        })
    }
}
