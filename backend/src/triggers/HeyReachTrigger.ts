import { ConfigType, HeyReachInputConfigData } from "terse-types/Configs"

import { db } from "../prismaClient"
import { PrismaTransaction } from "../types/prisma"

import { Trigger } from "./Trigger"

export class HeyReachTrigger implements Trigger<HeyReachInputConfigData> {
    configType: ConfigType = ConfigType.HEY_REACH_INPUT

    async validateConfig(trigger: HeyReachInputConfigData, _userId: string): Promise<void> {
        const integration = await db().hey_reach_integrations.findUnique({ where: { id: trigger.integrationId } })
        if (!integration) {
            throw new Error(`HeyReach integration ${trigger.integrationId} not found`)
        }
        if (!trigger.eventTypes.length) {
            throw new Error("HeyReach trigger requires at least one event type")
        }
    }

    async addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, trigger: HeyReachInputConfigData): Promise<void> {
        await tx.automation_hey_reach_configs.create({
            data: {
                automation_input_id: agentTriggerId,
                event_types: trigger.eventTypes,
                campaign_ids: trigger.campaignIds
            }
        })
    }
}
