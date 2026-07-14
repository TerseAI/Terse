import type { IntegrationType, ProjectConnections, ToolDefinition } from "terse-types"

import type { GeneratedFile } from "./LanguageProvider.js"

export interface CodegenRunInput {
    apiKey: string
    activeTypes: readonly IntegrationType[]
    availableIntegrations: readonly string[]
    tools: ToolDefinition[]
    activeConnections: ProjectConnections
}

export interface CodegenHooks {
    onFetchComplete?: () => void
}

export interface IntegrationSummary {
    label: string
    instanceCount: number
}

export interface CodegenResult {
    files: GeneratedFile[]
    integrationSummaries: IntegrationSummary[]
}
