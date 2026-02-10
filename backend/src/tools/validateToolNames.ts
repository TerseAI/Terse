import { CapabilityRole } from "../capabilityHelpers"
import { KnowledgeBaseFactory } from "../knowledgeBase/abstract/KnowledgeBaseFactory"
import logger from "../logger"
import { OutputFactory } from "../outputs/abstract/OutputFactory"

import { isValidToolName } from "./ToolNames"

/** Only OUTPUT and KNOWLEDGE_BASE are used in tool validation (triggers have no toolbox). */
type ToolSourceRole = CapabilityRole.OUTPUT | CapabilityRole.KNOWLEDGE_BASE

function getSourceDisplayName(source: ToolSourceRole): string {
    return source === CapabilityRole.OUTPUT ? "OutputFactory" : "KnowledgeBaseFactory"
}

type ToolOccurrence = {
    toolName: string
    source: ToolSourceRole
    configType: string
    tool: { name: string }
}

/**
 * Validates that all tool names are unique across all outputs and knowledge bases,
 * and that all tool names are defined in the ToolName enum.
 * Throws an error if duplicates are found or if any tool name is not in the enum,
 * preventing the app from starting.
 */
export function validateAllToolNames(): void {
    const toolOccurrences = new Map<string, ToolOccurrence[]>()
    const invalidToolNames: Array<{ toolName: string; source: ToolSourceRole; configType: string }> = []

    // Collect tools from all outputs
    OutputFactory.OUTPUT_REGISTRY.forEach((factory, outputConfigType) => {
        const output = factory()
        output.toolbox.forEach(entry => {
            const toolName = entry.tool.name

            // Check if tool name is in the enum
            if (!isValidToolName(toolName)) {
                invalidToolNames.push({
                    toolName,
                    source: CapabilityRole.OUTPUT,
                    configType: outputConfigType
                })
            }

            if (!toolOccurrences.has(toolName)) {
                toolOccurrences.set(toolName, [])
            }
            toolOccurrences.get(toolName)!.push({
                toolName,
                source: CapabilityRole.OUTPUT,
                configType: outputConfigType,
                tool: entry.tool
            })
        })
    })

    // Collect tools from all knowledge bases
    KnowledgeBaseFactory.KNOWLEDGE_BASE_REGISTRY.forEach((factory, kbConfigType) => {
        const kb = factory()
        kb.toolbox.forEach(entry => {
            const toolName = entry.tool.name

            // Check if tool name is in the enum
            if (!isValidToolName(toolName)) {
                invalidToolNames.push({
                    toolName,
                    source: CapabilityRole.KNOWLEDGE_BASE,
                    configType: kbConfigType
                })
            }

            if (!toolOccurrences.has(toolName)) {
                toolOccurrences.set(toolName, [])
            }
            toolOccurrences.get(toolName)!.push({
                toolName,
                source: CapabilityRole.KNOWLEDGE_BASE,
                configType: kbConfigType,
                tool: entry.tool
            })
        })
    })

    // Check for invalid tool names (not in enum)
    if (invalidToolNames.length > 0) {
        const errorMessages = invalidToolNames.map(({ toolName, source, configType }) => {
            return `Tool name '${toolName}' in ${getSourceDisplayName(source)} (${configType}) is not defined in ToolName enum`
        })

        const errorMessage = `Invalid tool names detected. All tool names must be defined in ToolName enum.\n\n${errorMessages.join("\n")}\n\nPlease add these tool names to backend/src/tools/ToolNames.ts`
        logger.error("Tool name validation failed - invalid tool names", { invalidToolNames })
        throw new Error(errorMessage)
    }

    // Check for duplicates: only error when the same tool name is used by different tool implementations.
    // Intentional reuse (e.g. linear_search_ticket in both Output and Knowledge Base) is allowed when it's the same tool reference.
    const duplicateEntries = Array.from(toolOccurrences.entries()).filter(([, occurrences]) => occurrences.length > 1)

    for (const [toolName, occurrences] of duplicateEntries) {
        const firstTool = occurrences[0].tool
        const allSameTool = occurrences.every(occ => occ.tool === firstTool)
        if (!allSameTool) {
            const sources = occurrences.map(occ => `${getSourceDisplayName(occ.source)} (${occ.configType})`).join(" and ")
            const errorMessage = `Duplicate tool name '${toolName}' found in: ${sources}. The same tool name must refer to the same tool implementation (e.g. reuse the same tool reference in both Output and Knowledge Base).`
            logger.error("Tool name validation failed - duplicate names with different implementations", { toolName, occurrences })
            throw new Error(errorMessage)
        }
    }
}

type WriteToolMissingApproval = {
    toolName: string
    source: ToolSourceRole
    configType: string
}

export function validateWriteToolsHaveNeedsApproval(): void {
    const missing: WriteToolMissingApproval[] = []

    const check = (source: ToolSourceRole, configType: string, entry: { tool: { name: string }; isReadOnly: boolean }) => {
        if (entry.isReadOnly) return
        const t = entry.tool as { name: string; needsApproval?: (ctx: unknown) => Promise<boolean> | boolean }
        if (typeof t.needsApproval !== "function") {
            missing.push({ toolName: t.name, source, configType })
        }
    }

    OutputFactory.OUTPUT_REGISTRY.forEach((factory, outputConfigType) => {
        const output = factory()
        output.toolbox.forEach(entry => {
            check(CapabilityRole.OUTPUT, outputConfigType, entry)
        })
    })

    KnowledgeBaseFactory.KNOWLEDGE_BASE_REGISTRY.forEach((factory, kbConfigType) => {
        const kb = factory()
        kb.toolbox.forEach(entry => {
            check(CapabilityRole.KNOWLEDGE_BASE, kbConfigType, entry)
        })
    })

    if (missing.length > 0) {
        const messages = missing.map(({ toolName, source, configType }) => `Write tool '${toolName}' (${getSourceDisplayName(source)}, ${configType}) is missing needsApproval`)
        const errorMessage = `Write tools missing needsApproval. All non-read-only tools must define needsApproval.\n\n${messages.join("\n")}\n\nAdd needsApproval: createNeedsApprovalFunction(ToolName.X) to each write tool.`
        logger.error("Write tool validation failed - missing needsApproval", { missing })
        throw new Error(errorMessage)
    }
}

/**
 * Runs all startup validations (tool names, write-tool approvals, etc.).
 * Throws if any validation fails. Call once before the server listens.
 */
export function runStartupValidations(): void {
    validateAllToolNames()
    validateWriteToolsHaveNeedsApproval()
}
