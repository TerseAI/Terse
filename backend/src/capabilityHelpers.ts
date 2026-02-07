import { ConfigType, CONFIG_DETAILS } from "./shared/Configs"
import { IntegrationType } from "./shared/Integrations"
import type { ToolboxEntry } from "./outputs/abstract/Output"

// MARK: - Types

export interface ToolInfo {
    name: string
    displayName: string
    description: string
    isReadOnly: boolean
    integration: IntegrationType
}

export interface ConfigMeta {
    name: string
    description: string
    integrationType: IntegrationType
    isInput: boolean
    isOutput: boolean
    isKnowledgeBase: boolean
}

export interface CapabilityDescription {
    name: string
    description: string
    configType: ConfigType
    integrationType: IntegrationType
    role: "trigger" | "knowledgeBase" | "output"
    tools: ToolInfo[]
    configFields: Record<string, string>
    systemInstructions: string
}

// MARK: - Helpers

/**
 * Extracts tool metadata from any KB or Output's toolbox array.
 * Uses existing metadata on toolbox entries - no restating.
 */
export function extractToolMetadata(toolbox: readonly ToolboxEntry[]): ToolInfo[] {
    return toolbox.map(entry => ({
        name: entry.tool.name,
        displayName: entry.displayName,
        description: (entry.tool as { description?: string }).description ?? "",
        isReadOnly: entry.isReadOnly,
        integration: entry.integration
    }))
}

/**
 * Looks up name/description/role from CONFIG_DETAILS for a given config type.
 */
export function getConfigMetadata(configType: ConfigType): ConfigMeta {
    const details = CONFIG_DETAILS[configType]
    return {
        name: details.name,
        description: details.description,
        integrationType: details.integrationType,
        isInput: details.isInput,
        isOutput: details.isOutput,
        isKnowledgeBase: details.isKnowledgeBase
    }
}
