import { ConfigType, FigmaConfig } from "terse-types/Configs"

import { FigmaIntegrationManager, validateFigmaFileExists } from "../integrations/FigmaIntegration"
import { PrismaTransaction } from "../types/prisma"

import { Trigger } from "./Trigger"

export class FigmaTrigger implements Trigger<FigmaConfig> {
    integrationManager: FigmaIntegrationManager
    configType: ConfigType = ConfigType.FIGMA

    constructor() {
        this.integrationManager = new FigmaIntegrationManager()
    }

    async validateConfig(trigger: FigmaConfig, _userId: string): Promise<void> {
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
