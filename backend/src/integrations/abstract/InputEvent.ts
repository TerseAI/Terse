import { IntegrationType } from "../../shared/Integrations";
import { AgentTriggerWithConfigs, User } from "../../types/prisma";
import { RunHistoryTrigger } from "../../shared/RunHistoryTypes";
import { Identifiable } from "../../rag/Hydrator";
import { ConfigInstance } from "../../shared/Configs";
import { SampleEvent } from "../../shared/SampleEvents";

export abstract class InputEvent {
    abstract readonly integrationType: IntegrationType;

    constructor() {
        // No initialization needed - integrationType is set by subclasses
    }

    // This method will be used to format the Event into the format expected by the LLM. MUST BE A STRING
    abstract formatForAgentRunner(): string;

    // Use this for formatting how we log this
    abstract debugLog(): string;

    /**
     * Check if this event matches the given agent trigger.
     * Each event subclass implements its own filtering logic.
     * @param agentTrigger The agent trigger to check against (with config relations loaded)
     * @returns true if this event matches the agent trigger
     */
    abstract matchesAgentTrigger(agentTrigger: AgentTriggerWithConfigs): boolean;

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
     * Get the timestamp of this event as an ISO string.
     * Each event subclass extracts the timestamp from its event-specific data.
     * @returns ISO timestamp string
     */
    abstract getEventTimestamp(): string;

    /**
     * 
     * Get sample events for the given config that can be used for testing.
     */
    static async getSampleEvents(config: ConfigInstance): Promise<SampleEvent[]> {
        throw new Error('Method not implemented! Use derived class');
    }

    static async sendSampleEventToAgent(sampleEvent: SampleEvent, agentId: string, user: User): Promise<void> {
        throw new Error('Method not implemented! Use derived class');
    }

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

