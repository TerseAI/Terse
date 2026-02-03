import { KnowledgeBaseFactory } from "../knowledgeBase/abstract/KnowledgeBaseFactory"
import logger from "../logger"
import { OutputFactory } from "../outputs/abstract/OutputFactory"

import { ToolName, VALID_TOOL_NAMES_SET, isValidToolName } from "./ToolNames"

type ToolOccurrence = {
    toolName: string
    source: "output" | "knowledgeBase"
    configType: string
}

/**
 * Validates that all tool names are unique across all outputs and knowledge bases,
 * and that all tool names are defined in the ToolName enum.
 * Throws an error if duplicates are found or if any tool name is not in the enum,
 * preventing the app from starting.
 */
export function validateAllToolNames(): void {
    const toolOccurrences = new Map<string, ToolOccurrence[]>()
    const invalidToolNames: Array<{ toolName: string; source: "output" | "knowledgeBase"; configType: string }> = []

    // Collect tools from all outputs
    OutputFactory.OUTPUT_REGISTRY.forEach((factory, outputConfigType) => {
        const output = factory()
        output.toolbox.forEach(entry => {
            const toolName = entry.tool.name

            // Check if tool name is in the enum
            if (!isValidToolName(toolName)) {
                invalidToolNames.push({
                    toolName,
                    source: "output",
                    configType: outputConfigType
                })
            }

            if (!toolOccurrences.has(toolName)) {
                toolOccurrences.set(toolName, [])
            }
            toolOccurrences.get(toolName)!.push({
                toolName,
                source: "output",
                configType: outputConfigType
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
                    source: "knowledgeBase",
                    configType: kbConfigType
                })
            }

            if (!toolOccurrences.has(toolName)) {
                toolOccurrences.set(toolName, [])
            }
            toolOccurrences.get(toolName)!.push({
                toolName,
                source: "knowledgeBase",
                configType: kbConfigType
            })
        })
    })

    // Check for invalid tool names (not in enum)
    if (invalidToolNames.length > 0) {
        const errorMessages = invalidToolNames.map(({ toolName, source, configType }) => {
            const sourceName = source === "output" ? "OutputFactory" : "KnowledgeBaseFactory"
            return `Tool name '${toolName}' in ${sourceName} (${configType}) is not defined in ToolName enum`
        })

        const errorMessage = `Invalid tool names detected. All tool names must be defined in ToolName enum.\n\n${errorMessages.join("\n")}\n\nPlease add these tool names to backend/src/tools/ToolNames.ts`
        logger.error("Tool name validation failed - invalid tool names", { invalidToolNames })
        throw new Error(errorMessage)
    }

    // Check for duplicates
    const duplicates = Array.from(toolOccurrences.entries())
        .filter(([, occurrences]) => occurrences.length > 1)
        .map(([toolName, occurrences]) => ({ toolName, occurrences }))

    if (duplicates.length > 0) {
        const errorMessages = duplicates.map(({ toolName, occurrences }) => {
            const sources = occurrences.map(occ => `${occ.source === "output" ? "OutputFactory" : "KnowledgeBaseFactory"} (${occ.configType})`).join(" and ")
            return `Duplicate tool name '${toolName}' found in: ${sources}`
        })

        const errorMessage = `Duplicate tool names detected. The application cannot start.\n\n${errorMessages.join("\n")}`
        logger.error("Tool name validation failed - duplicates", { duplicates })
        throw new Error(errorMessage)
    }
}

type WriteToolMissingApproval = {
    toolName: string
    source: "output" | "knowledgeBase"
    configType: string
}

export function validateWriteToolsHaveNeedsApproval(): void {
    const missing: WriteToolMissingApproval[] = []

    const check = (source: "output" | "knowledgeBase", configType: string, entry: { tool: { name: string }; isReadOnly: boolean }) => {
        if (entry.isReadOnly) return
        const t = entry.tool as { name: string; needsApproval?: (ctx: unknown) => Promise<boolean> | boolean }
        if (typeof t.needsApproval !== "function") {
            missing.push({ toolName: t.name, source, configType })
        }
    }

    OutputFactory.OUTPUT_REGISTRY.forEach((factory, outputConfigType) => {
        const output = factory()
        output.toolbox.forEach(entry => {
            check("output", outputConfigType, entry)
        })
    })

    KnowledgeBaseFactory.KNOWLEDGE_BASE_REGISTRY.forEach((factory, kbConfigType) => {
        const kb = factory()
        kb.toolbox.forEach(entry => {
            check("knowledgeBase", kbConfigType, entry)
        })
    })

    if (missing.length > 0) {
        const messages = missing.map(
            ({ toolName, source, configType }) => `Write tool '${toolName}' (${source === "output" ? "OutputFactory" : "KnowledgeBaseFactory"}, ${configType}) is missing needsApproval`
        )
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
