import { CapabilityDescription, getConfigMetadata } from "../capabilityHelpers"
import { GmailIntegrationManager } from "../integrations/GmailIntegration"
import { ConfigType, GmailConfig } from "../shared/Configs"
import { PrismaTransaction } from "../types/prisma"

import { Trigger } from "./Trigger"

export class GmailTrigger implements Trigger<GmailConfig> {
    integrationManager: GmailIntegrationManager
    configType: ConfigType = ConfigType.GMAIL

    constructor() {
        this.integrationManager = new GmailIntegrationManager()
    }

    getCapabilityDescription(): CapabilityDescription {
        const meta = getConfigMetadata(ConfigType.GMAIL)
        return {
            name: meta.name,
            description: meta.description,
            configType: ConfigType.GMAIL,
            integrationType: meta.integrationType,
            role: "trigger",
            tools: [],
            configFields: {
                integrationId: "<integrationId>"
            },
            systemInstructions: ""
        }
    }

    async validateConfig(_trigger: GmailConfig, _userId: string): Promise<void> {
        // No additional config validation beyond integration ownership.
    }

    async addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, trigger: GmailConfig): Promise<void> {
        await tx.automation_gmail_configs.create({
            data: {
                automation_input_id: agentTriggerId
            }
        })
    }
}
