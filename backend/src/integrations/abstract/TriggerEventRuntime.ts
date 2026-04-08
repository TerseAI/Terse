import type { IntegrationType, RunHistoryTrigger, TriggerEvent } from "terse-types"
import { debugTriggerEvent, formatTriggerEventForAgent } from "terse-types"

import { Identifiable } from "../../rag/Hydrator"
import { StoredFile } from "../../services/FileStorageService"
import { AgentTriggerWithConfigs } from "../../types/prisma"

export abstract class TriggerEventRuntime {
    abstract readonly integrationType: IntegrationType
    abstract readonly eventType: string
    abstract readonly data: TriggerEvent

    formatForAgentRunner(): string {
        return formatTriggerEventForAgent(this.data)
    }

    debugLog(): string {
        return debugTriggerEvent(this.data)
    }

    abstract matchesAgentTrigger(agentTrigger: AgentTriggerWithConfigs): boolean
    abstract createTriggerMetadata(): RunHistoryTrigger

    getFiles(): StoredFile[] {
        return []
    }

    isIdentifiable(): this is TriggerEventRuntime & Identifiable {
        return "entityType" in this && "entityId" in this
    }

    getIdentifiableInfo(): Identifiable | null {
        if (this.isIdentifiable()) {
            return {
                entityType: this.entityType,
                entityId: this.entityId
            }
        }
        return null
    }
}
