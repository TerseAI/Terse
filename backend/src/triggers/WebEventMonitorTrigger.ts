import { ConfigType, WebEventMonitorConfig } from "terse-types/Configs"

import { PrismaTransaction } from "../types/prisma"

import { Trigger } from "./Trigger"

export class WebEventMonitorTrigger implements Trigger<WebEventMonitorConfig> {
    configType: ConfigType = ConfigType.WEBEVENT_MONITOR

    constructor() {}

    async validateConfig(trigger: WebEventMonitorConfig, _userId: string): Promise<void> {
        if (!trigger.query?.trim()) {
            throw new Error("Web Event trigger requires a non-empty query")
        }
        if (!trigger.frequency?.number || !trigger.frequency?.unit) {
            throw new Error("Web Event trigger requires a frequency number and unit")
        }
    }

    async addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, trigger: WebEventMonitorConfig): Promise<void> {
        await tx.automation_webevent_configs.create({
            data: {
                automation_input_id: agentTriggerId,
                query: trigger.query,
                frequency_number: trigger.frequency.number,
                frequency_unit: trigger.frequency.unit
            }
        })
    }
}
