import { FigmaIntegrationManager, validateFigmaFileExists } from "../integrations/FigmaIntegration"
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
