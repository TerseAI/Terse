import { CapabilityDescription, getConfigMetadata } from "../capabilityHelpers"
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

    getCapabilityDescription(): CapabilityDescription {
        const meta = getConfigMetadata(ConfigType.LINEAR_INPUT)
        return {
            name: meta.name,
            description: meta.description,
            configType: ConfigType.LINEAR_INPUT,
            integrationType: meta.integrationType,
            role: "trigger",
            tools: [],
            configFields: {
                integrationId: "<integrationId>",
                projectId: "Linear project ID to monitor (optional)",
                projectName: "Project display name"
            },
            systemInstructions: ""
        }
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
