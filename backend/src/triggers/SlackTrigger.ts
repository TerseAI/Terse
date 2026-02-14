import { CapabilityDescription, CapabilityRole, getConfigMetadata } from "../capabilityHelpers"
import { SlackIntegrationManager, getSlackAccessTokenOrThrow, validateSlackChannelsExist, validateSlackUserIds } from "../integrations/SlackIntegration"
import { ConfigType, SlackConfig } from "../shared/Configs"
import { PrismaTransaction } from "../types/prisma"
import { SlackConfigSchema, stripConfigForValidation } from "../utility/configSchemas"

import { Trigger } from "./Trigger"

export class SlackTrigger implements Trigger<SlackConfig> {
    integrationManager: SlackIntegrationManager
    configType: ConfigType = ConfigType.SLACK

    constructor() {
        this.integrationManager = new SlackIntegrationManager()
    }

    getCapabilityDescription(): CapabilityDescription {
        const meta = getConfigMetadata(ConfigType.SLACK)
        return {
            name: meta.name,
            description: meta.description,
            configType: ConfigType.SLACK,
            integrationType: meta.integrationType,
            role: CapabilityRole.TRIGGER,
            tools: [],
            configFields: {
                integrationId: "<integrationId>",
                channelId: "Slack channel ID to monitor (or use listenToUserDms)",
                channelName: "Channel display name",
                listenToUserDms: "Set true to trigger on direct messages instead of a channel",
                userIds: "Optional user IDs to filter which DMs trigger the agent"
            },
            systemInstructions: ""
        }
    }

    async validateConfig(trigger: SlackConfig, _userId: string): Promise<void> {
        SlackConfigSchema.parse(stripConfigForValidation(trigger))
        if (!trigger.channelId && !trigger.listenToUserDms) {
            throw new Error("Invalid trigger config for slack: requires channelId or listenToUserDms=true")
        }
        const channelIds = trigger.channelId ? [trigger.channelId] : []
        const userIds = trigger.userIds ?? []
        if (channelIds.length > 0 || userIds.length > 0) {
            const token = await getSlackAccessTokenOrThrow(trigger.integrationId)
            await validateSlackChannelsExist(token, channelIds)
            await validateSlackUserIds(token, userIds)
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
