import type { RunHistoryTrigger, SerializedEvent, Trigger } from "terse-types"
import { debugTrigger, displayTrigger, formatTriggerForAgent } from "terse-types"

import { Identifiable } from "../../hydrators/Hydrator"
import { StoredFile } from "../../services/FileStorageService"
import { AgentTriggerWithConfigs } from "../../types/prisma"

export abstract class TriggerRuntime<TEvent extends Trigger = Trigger> {
    abstract readonly integrationType: TEvent["integrationType"]
    abstract readonly data: TEvent

    // Stamped once per runtime so every serialization of the same event reports one trigger time.
    readonly triggeredAt: string = new Date().toISOString()

    get eventType(): TEvent["eventType"] {
        return this.data.eventType
    }

    formatForAgentRunner(): string {
        return formatTriggerForAgent(this.data)
    }

    debugLog(): string {
        return debugTrigger(this.data)
    }

    abstract matchesAgentTrigger(agentTrigger: AgentTriggerWithConfigs): boolean
    abstract createTriggerMetadata(): RunHistoryTrigger

    getFiles(): StoredFile[] {
        return []
    }

    isIdentifiable(): this is TriggerRuntime<TEvent> & Identifiable {
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
            triggeredAt: this.triggeredAt,
            display: displayTrigger(this.data),
            data: this.data
        }
    }
}
