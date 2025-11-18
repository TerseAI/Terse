import { IntegrationType } from "@prisma/client";
import { AutomationInputWithConfigs } from "../../types/prisma";
import { RunHistoryTrigger } from "../../shared/RunHistoryTypes";

export abstract class InputEvent {
    abstract readonly integrationType: IntegrationType;

    constructor() {
        // No initialization needed - integrationType is set by subclasses
    }

    // This method will be used to format the Event into the format expected by the LLM. MUST BE A STRING
    abstract formatForAutomationAgent(): string;

    // Use this for formatting how we log this
    abstract debugLog(): string;

    /**
     * Check if this event matches the given automation input.
     * Each event subclass implements its own filtering logic.
     * @param automationInput The automation input to check against (with config relations loaded)
     * @returns true if this event matches the automation input
     */
    abstract matchesAutomationInput(automationInput: AutomationInputWithConfigs): boolean;

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
}

