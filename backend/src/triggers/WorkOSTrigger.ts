import { CapabilityDescription, CapabilityRole, getConfigMetadata } from "../capabilityHelpers"
import { ConfigType, WorkOSInputConfig } from "../shared/Configs"
import { PrismaTransaction } from "../types/prisma"

import { Trigger } from "./Trigger"

export class WorkOSTrigger implements Trigger<WorkOSInputConfig> {
    configType: ConfigType = ConfigType.WORKOS_INPUT

    getCapabilityDescription(): CapabilityDescription {
        const meta = getConfigMetadata(ConfigType.WORKOS_INPUT)
        return {
            name: meta.name,
            description: meta.description,
            configType: ConfigType.WORKOS_INPUT,
            integrationType: meta.integrationType,
            role: CapabilityRole.TRIGGER,
            tools: [],
            configFields: {
                integrationId: "<integrationId>",
                eventTypes: "Array of WorkOS event types to listen for (e.g., user.created, user.deleted, organization_membership.created, invitation.accepted)"
            },
            systemInstructions: ""
        }
    }

    async validateConfig(trigger: WorkOSInputConfig, _userId: string): Promise<void> {
        if (!trigger.eventTypes || trigger.eventTypes.length === 0) {
            throw new Error("Invalid trigger config for WorkOS: at least one event type must be selected")
        }
    }

    async addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, trigger: WorkOSInputConfig): Promise<void> {
        await tx.automation_workos_configs.create({
            data: {
                automation_input_id: agentTriggerId,
                event_types: trigger.eventTypes
            }
        })
    }
}
