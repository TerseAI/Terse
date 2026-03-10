import { LinearIntegrationManager, validateLinearProjectExists } from "../integrations/LinearIntegration"
import { ConfigType, LinearInputConfig } from "../shared/Configs"
import { PrismaTransaction } from "../types/prisma"

import { Trigger } from "./Trigger"

export class LinearTrigger implements Trigger<LinearInputConfig> {
    integrationManager: LinearIntegrationManager
    configType: ConfigType = ConfigType.LINEAR_INPUT

    constructor() {
        this.integrationManager = new LinearIntegrationManager()
    }

    async validateConfig(trigger: LinearInputConfig, _userId: string): Promise<void> {
        // Not doing schema validation here because
        // it errors out. TODO: fix this.
        if (trigger.projectId) {
            await validateLinearProjectExists(trigger.integrationId, trigger.projectId)
        }
    }

    async addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, trigger: LinearInputConfig): Promise<void> {
        await tx.automation_linear_configs.create({
            data: {
                automation_input_id: agentTriggerId,
                project_id: trigger.projectId || null,
                project_name: trigger.projectName || null
            }
        })
    }
}
