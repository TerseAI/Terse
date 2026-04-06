import { ConfigType, WebhookInputConfig } from "terse-types/Configs"

import { PrismaTransaction } from "../types/prisma"

import { Trigger } from "./Trigger"

export class WebhookTrigger implements Trigger<WebhookInputConfig> {
    configType: ConfigType = ConfigType.WEBHOOK_INPUT

    async validateConfig(_trigger: WebhookInputConfig, _userId: string): Promise<void> {}

    async addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, _trigger: WebhookInputConfig): Promise<void> {
        await tx.automation_webhook_configs.create({
            data: {
                automation_input_id: agentTriggerId,
                webhook_token: crypto.randomUUID()
            }
        })
    }
}
