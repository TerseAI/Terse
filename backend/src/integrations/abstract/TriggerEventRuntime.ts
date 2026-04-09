import type { RunHistoryTrigger, SerializedEvent, TriggerEvent } from "terse-types"
import { debugTriggerEvent, formatTriggerEventForAgent } from "terse-types"

import { Identifiable } from "../../rag/Hydrator"
import { StoredFile } from "../../services/FileStorageService"
import { AgentTriggerWithConfigs } from "../../types/prisma"

export abstract class TriggerEventRuntime<TEvent extends TriggerEvent = TriggerEvent> {
    abstract readonly integrationType: TEvent["integrationType"]
    abstract readonly data: TEvent

    get eventType(): TEvent["eventType"] {
        return this.data.eventType
    }

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

    isIdentifiable(): this is TriggerEventRuntime<TEvent> & Identifiable {
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

    getSerializedEvent(): SerializedEvent {
        return {
            integrationType: this.integrationType,
            eventType: this.eventType,
            formattedContent: this.formatForAgentRunner(),
            debugLog: this.debugLog(),
            data: this.data
        }
    }
}
