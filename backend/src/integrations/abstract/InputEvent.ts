import { IntegrationType } from "../../shared/Integrations";
import { AgentTriggerWithConfigs } from "../../types/prisma";
import { RunHistoryTrigger } from "../../shared/RunHistoryTypes";
import { Identifiable } from "../../rag/Hydrator";
import { StoredFile } from "../../services/FileStorageService";

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
     * Get file attachments associated with this event with full metadata.
     * Returns files categorized by type (image, document, text) for proper multimodal handling.
     *
     * @returns Array of StoredFile objects with URL, mimeType, and category. Empty array if no files.
     */
    getFiles(): StoredFile[] {
        // Default implementation returns empty array
        // Subclasses can override to return files with full metadata
        return [];
    }

    /**
     * Get document URLs (PDFs) associated with this event.
     * Documents can be processed by Claude's PDF support for visual analysis.
     * @returns Array of document URL strings. Empty array if no documents are available.
     */
    getDocumentUrls(): string[] {
        // Default implementation: filter files by category
        return this.getFiles()
            .filter(f => f.category === 'document')
            .map(f => f.url);
    }

    /**
     * Get text file content associated with this event.
     * Text files (TXT, MD, CSV, DOCX, XLSX) have their content extracted.
     * Note: Currently returns URLs for text files; content extraction may be added later.
     * @returns Array of text file URLs. Empty array if no text files are available.
     */
    getTextFileUrls(): string[] {
        // Default implementation: filter files by category
        return this.getFiles()
            .filter(f => f.category === 'text')
            .map(f => f.url);
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

