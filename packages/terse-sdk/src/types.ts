import { IntegrationType } from "./shared/Integrations.js"

/**
 * Lightweight interface for input events.
 * The backend's concrete InputEvent abstract class structurally satisfies this interface.
 */
export interface InputEvent {
    readonly integrationType: IntegrationType
    readonly eventType: string
    formatForAgentRunner(): string
    debugLog(): string
}

/**
 * Lightweight interface for toolbox entries.
 * The backend's concrete ToolboxEntry (which depends on @openai/agents Tool) structurally satisfies this interface.
 */
export interface ToolboxEntry {
    isReadOnly: boolean
    integration: IntegrationType
    displayName: string
}
