import { Prisma } from "@prisma/client"
import { ConfigType, WebMonitorConfig } from "terse-types/Configs"

import { PrismaTransaction } from "../types/prisma"

import { Trigger } from "./Trigger"

export class WebMonitorTrigger implements Trigger<WebMonitorConfig> {
    configType: ConfigType = ConfigType.WEBMONITOR

    constructor() {}

    async validateConfig(trigger: WebMonitorConfig, _userId: string): Promise<void> {
        if (!trigger.query?.trim()) {
            throw new Error("Web Event trigger requires a non-empty query")
        }
        if (!trigger.frequency?.number || !trigger.frequency?.unit) {
            throw new Error("Web Event trigger requires a frequency number and unit")
        }
    }

    async addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, trigger: WebMonitorConfig): Promise<void> {
        await tx.automation_webmonitor_configs.create({
            data: {
                automation_input_id: agentTriggerId,
                query: trigger.query,
                frequency_number: trigger.frequency.number,
                frequency_unit: trigger.frequency.unit,
                output_schema: trigger.outputSchema ? (trigger.toJSON().outputSchema as Prisma.InputJsonValue) : undefined
            }
        })
    }
}
