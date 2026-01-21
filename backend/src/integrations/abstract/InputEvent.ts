import { IntegrationType } from "../../shared/Integrations";
import { AgentInputWithConfigs } from "../../types/prisma";
import { RunHistoryTrigger } from "../../shared/RunHistoryTypes";
import { Identifiable } from "../../rag/Hydrator";

export abstract class InputEvent {
    abstract readonly integrationType: IntegrationType;

    constructor() {
        // No initialization needed - integrationType is set by subclasses
    }

    // This method will be used to format the Event into the format expected by the LLM. MUST BE A STRING
    abstract formatForAgent(): string;

    // Use this for formatting how we log this
    abstract debugLog(): string;

    /**
     * Check if this event matches the given agent trigger.
     * Each event subclass implements its own filtering logic.
     * @param agentInput The agent trigger to check against (with config relations loaded)
     * @returns true if this event matches the agent trigger
     */
    abstract matchesAgentInput(agentInput: AgentInputWithConfigs): boolean;

    /**
     * Create trigger metadata for run history.
     * Each event subclass implements its own metadata extraction.
     * @returns RunHistoryTrigger with event-specific fields
     */
    abstract createTriggerMetadata(): RunHistoryTrigger;

    /**
     * Get image URLs associated with this event.
     * Events that include images (e.g., Figma comments with visual context) should return their URLs here.
     * @returns Array of image URL strings. Empty array if no images are available.
     */
    abstract getImageUrls(): string[];

    /**
     * Check if this InputEvent implements Identifiable.
     * Only InputEvents that conform to Identifiable can be tracked for output change attributions.
     * @returns true if this event implements Identifiable
     */
    isIdentifiable(): this is InputEvent & Identifiable {
        return 'entityType' in this && 'entityId' in this;
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
            };
        }
        return null;
    }
}

