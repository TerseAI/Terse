import { db } from "../prismaClient"
import { SlackIntegrationManager } from "../integrations/SlackIntegration"
import { ConfigType, SlackConfig } from "../shared/Configs"
import { PrismaTransaction } from "../types/prisma"

import { Trigger } from "./Trigger"

export class SlackTrigger implements Trigger<SlackConfig> {
    integrationManager: SlackIntegrationManager
    configType: ConfigType = ConfigType.SLACK

    constructor() {
        this.integrationManager = new SlackIntegrationManager()
    }

    async validateConfig(trigger: SlackConfig, _userId: string): Promise<void> {
        if (!trigger.channelId && !trigger.listenToUserDms) {
            throw new Error("Invalid trigger config for slack: requires channelId or listenToUserDms=true")
        }
        if (trigger.listenToUserDms) {
            const usi = await db().user_slack_integrations.findUnique({
                where: { id: trigger.integrationId }
            })
            if (usi?.is_bot_user) {
                throw new Error("Listening to your DMs requires a Slack user token. Reconnect Slack with a user token.")
            }
        }
    }

    async addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, trigger: SlackConfig): Promise<void> {
        await tx.automation_slack_configs.create({
            data: {
                automation_input_id: agentTriggerId, // Database column is still automation_input_id
                channel_id: trigger.channelId,
                channel_name: trigger.channelName,
                listen_to_user_dms: trigger.listenToUserDms,
                user_ids: trigger.userIds || []
            }
        })
    }
}
