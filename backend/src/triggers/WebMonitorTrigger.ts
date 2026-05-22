import { Prisma } from "@prisma/client"
import { ConfigType, WebMonitorConfig, WebMonitorConfigSchema, WebMonitorOutputSchema } from "terse-types/Configs"

import { buildWebhookUrl, createMonitor } from "../integrations/webMonitor/integration"
import { PrismaTransaction } from "../types/prisma"

import { Trigger } from "./Trigger"

export class WebMonitorTrigger implements Trigger<WebMonitorConfig> {
    configType: ConfigType = ConfigType.WEBMONITOR

    constructor() {}

    async validateConfig(trigger: WebMonitorConfig, _userId: string): Promise<void> {
        WebMonitorConfigSchema.parse(trigger)
    }

    async addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, trigger: WebMonitorConfig): Promise<void> {
        const webhookUrl = buildWebhookUrl(agentTriggerId)
        const created = await createMonitor({
            query: trigger.query,
            frequency: trigger.frequency,
            webhook: { url: webhookUrl, event_types: ["monitor.event.detected"] },
            metadata: { terse_automation_input_id: agentTriggerId },
            output_schema: trigger.outputSchema as WebMonitorOutputSchema | undefined
        })
        const monitorId = created.monitor_id
        if (!monitorId) {
            throw new Error("Parallel monitor create response missing monitor_id")
        }

        await tx.automation_webmonitor_configs.create({
            data: {
                automation_input_id: agentTriggerId,
                provider_monitor_id: monitorId
            }
        })
    }
}
