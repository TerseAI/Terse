import { Prisma } from "@prisma/client"
import { ConfigType, WebMonitorConfig, WebMonitorConfigSchema } from "terse-types/Configs"

import { PrismaTransaction } from "../types/prisma"

import { Trigger } from "./Trigger"

export class WebMonitorTrigger implements Trigger<WebMonitorConfig> {
    configType: ConfigType = ConfigType.WEBMONITOR

    constructor() {}

    async validateConfig(trigger: WebMonitorConfig, _userId: string): Promise<void> {
        WebMonitorConfigSchema.parse(trigger)
    }

    async addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, trigger: WebMonitorConfig): Promise<void> {
        await tx.automation_webmonitor_configs.create({
            data: {
                automation_input_id: agentTriggerId,
                query: trigger.query,
                frequency_number: trigger.frequency.number,
                frequency_unit: trigger.frequency.unit,
                output_schema: trigger.outputSchema ? (trigger.outputSchema as Prisma.InputJsonValue) : undefined
            }
        })
    }
}
