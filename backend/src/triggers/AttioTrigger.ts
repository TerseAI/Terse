import { AttioInputConfigData, ConfigType } from "terse-types/Configs"

import { createAttioWebhook } from "../integrations/AttioIntegration"
import { db } from "../loaders/prisma"
import { PrismaTransaction } from "../types/prisma"

import { Trigger } from "./Trigger"

export class AttioTrigger implements Trigger<AttioInputConfigData> {
    configType: ConfigType = ConfigType.ATTIO_INPUT

    async validateConfig(trigger: AttioInputConfigData, _userId: string): Promise<void> {
        const integration = await db().attio_integrations.findUnique({ where: { id: trigger.integrationId } })
        if (!integration) {
            throw new Error(`Attio integration ${trigger.integrationId} not found`)
        }
        if (trigger.subscriptions.length === 0) {
            throw new Error("Attio trigger requires at least one subscription")
        }
    }

    async addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, trigger: AttioInputConfigData): Promise<void> {
        const webhookId = await createAttioWebhook(tx, agentTriggerId, trigger.integrationId, trigger.subscriptions)
        await tx.automation_attio_input_configs.create({
            data: {
                automation_input_id: agentTriggerId,
                webhook_id: webhookId
            }
        })
    }
}
