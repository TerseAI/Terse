import { Identifiable } from "../../rag/Hydrator"
import { StoredFile } from "../../services/FileStorageService"
import { IntegrationType } from "../../shared/Integrations"
import { RunHistoryTrigger } from "../../shared/RunHistoryTypes"
import { AgentTriggerWithConfigs } from "../../types/prisma"

export abstract class InputEvent {
    abstract readonly integrationType: IntegrationType

    /**
     * The specific event type within this integration.
     * Used by SDK triggers to filter on specific events (e.g. "pull_request.opened", "message").
     * Values must match the corresponding SDK event type enum values.
     */
    abstract readonly eventType: string

    constructor() {
        // No initialization needed - integrationType is set by subclasses
    }

    // This method will be used to format the Event into the format expected by the LLM. MUST BE A STRING
    abstract formatForAgentRunner(): string

    // Use this for formatting how we log this
    abstract debugLog(): string

    /**
     * Check if this event matches the given agent trigger.
     * Each event subclass implements its own filtering logic.
     * @param agentTrigger The agent trigger to check against (with config relations loaded)
     * @returns true if this event matches the agent trigger
     */
    abstract matchesAgentTrigger(agentTrigger: AgentTriggerWithConfigs): boolean

    /**
     * Create trigger metadata for run history.
     * Each event subclass implements its own metadata extraction.
     * @returns RunHistoryTrigger with event-specific fields
     */
    abstract createTriggerMetadata(): RunHistoryTrigger

    /**
     * Get file attachments associated with this event with full metadata.
     * Returns files categorized by type (image, document, text) for proper multimodal handling.
     *
     * @returns Array of StoredFile objects with URL, mimeType, and category. Empty array if no files.
     */
    getFiles(): StoredFile[] {
        // Default implementation returns empty array
        // Subclasses can override to return files with full metadata
        return []
    }

    /**
     * Check if this InputEvent implements Identifiable.
     * Only InputEvents that conform to Identifiable can be tracked for output change attributions.
     * @returns true if this event implements Identifiable
     */
    isIdentifiable(): this is InputEvent & Identifiable {
        return "entityType" in this && "entityId" in this
    }

    /**
     * Get the Identifiable info if this event implements it.
     * @returns Identifiable info or null if not implemented
     */
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
