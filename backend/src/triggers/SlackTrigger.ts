import { SlackIntegrationManager } from "../integrations/SlackIntegration";
import { ConfigType, SlackConfig } from "../shared/Configs";
import { Trigger } from "./Trigger";
import { PrismaTransaction } from "../types/prisma";

export class SlackTrigger implements Trigger<SlackConfig> {
    integrationManager: SlackIntegrationManager;
    configType: ConfigType = ConfigType.SLACK;

    constructor() {
        this.integrationManager = new SlackIntegrationManager();
    }

    async validateConfig(trigger: SlackConfig, _userId: string): Promise<void> {
        if (!trigger.channelId && !trigger.listenToUserDms) {
            throw new Error('Invalid trigger config for slack: requires channelId or listenToUserDms=true');
        }
    }

    async addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, trigger: SlackConfig): Promise<void> {
        await tx.automation_slack_configs.create({
            data: {
                automation_input_id: agentTriggerId, // Database column is still automation_input_id
                channel_id: trigger.channelId,
                channel_name: trigger.channelName,
                listen_to_user_dms: trigger.listenToUserDms,
                user_ids: trigger.userIds || [],
            },
        });
    }
}
