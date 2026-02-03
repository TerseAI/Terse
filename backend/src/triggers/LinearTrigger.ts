import { LinearIntegrationManager } from "../integrations/LinearIntegration"
import { ConfigType, LinearInputConfig } from "../shared/Configs"
import { PrismaTransaction } from "../types/prisma"

import { Trigger } from "./Trigger"

export class LinearTrigger implements Trigger<LinearInputConfig> {
    integrationManager: LinearIntegrationManager
    configType: ConfigType = ConfigType.LINEAR_INPUT

    constructor() {
        this.integrationManager = new LinearIntegrationManager()
    }

    async validateConfig(_trigger: LinearInputConfig, _userId: string): Promise<void> {
        // No additional config validation beyond integration ownership.
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
