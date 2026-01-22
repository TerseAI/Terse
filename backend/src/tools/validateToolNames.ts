import { OutputFactory } from '../outputs/abstract/OutputFactory';
import { KnowledgeBaseFactory } from '../knowledgeBase/abstract/KnowledgeBaseFactory';
import { ToolName, VALID_TOOL_NAMES_SET, isValidToolName } from './ToolNames';
import logger from '../logger';

type ToolOccurrence = {
    toolName: string;
    source: 'output' | 'knowledgeBase';
    configType: string;
};

/**
 * Validates that all tool names are unique across all outputs and knowledge bases,
 * and that all tool names are defined in the ToolName enum.
 * Throws an error if duplicates are found or if any tool name is not in the enum,
 * preventing the app from starting.
 */
export function validateAllToolNames(): void {
    const toolOccurrences = new Map<string, ToolOccurrence[]>();
    const invalidToolNames: Array<{ toolName: string; source: 'output' | 'knowledgeBase'; configType: string }> = [];

    // Collect tools from all outputs
    for (const [outputConfigType, factory] of OutputFactory.OUTPUT_REGISTRY.entries()) {
        const output = factory();
        for (const entry of output.toolbox) {
            const toolName = entry.tool.name;
            
            // Check if tool name is in the enum
            if (!isValidToolName(toolName)) {
                invalidToolNames.push({
                    toolName,
                    source: 'output',
                    configType: outputConfigType,
                });
            }
            
            if (!toolOccurrences.has(toolName)) {
                toolOccurrences.set(toolName, []);
            }
            toolOccurrences.get(toolName)!.push({
                toolName,
                source: 'output',
                configType: outputConfigType,
            });
        }
    }

    // Collect tools from all knowledge bases
    for (const [kbConfigType, factory] of KnowledgeBaseFactory.KNOWLEDGE_BASE_REGISTRY.entries()) {
        const kb = factory();
        for (const entry of kb.toolbox) {
            const toolName = entry.tool.name;
            
            // Check if tool name is in the enum
            if (!isValidToolName(toolName)) {
                invalidToolNames.push({
                    toolName,
                    source: 'knowledgeBase',
                    configType: kbConfigType,
                });
            }
            
            if (!toolOccurrences.has(toolName)) {
                toolOccurrences.set(toolName, []);
            }
            toolOccurrences.get(toolName)!.push({
                toolName,
                source: 'knowledgeBase',
                configType: kbConfigType,
            });
        }
    }

    // Check for invalid tool names (not in enum)
    if (invalidToolNames.length > 0) {
        const errorMessages = invalidToolNames.map(({ toolName, source, configType }) => {
            const sourceName = source === 'output' ? 'OutputFactory' : 'KnowledgeBaseFactory';
            return `Tool name '${toolName}' in ${sourceName} (${configType}) is not defined in ToolName enum`;
        });

        const errorMessage = `Invalid tool names detected. All tool names must be defined in ToolName enum.\n\n${errorMessages.join('\n')}\n\nPlease add these tool names to backend/src/tools/ToolNames.ts`;
        logger.error('Tool name validation failed - invalid tool names', { invalidToolNames });
        throw new Error(errorMessage);
    }

    // Check for duplicates
    const duplicates: Array<{ toolName: string; occurrences: ToolOccurrence[] }> = [];
    for (const [toolName, occurrences] of toolOccurrences.entries()) {
        if (occurrences.length > 1) {
            duplicates.push({ toolName, occurrences });
        }
    }

    if (duplicates.length > 0) {
        const errorMessages = duplicates.map(({ toolName, occurrences }) => {
            const sources = occurrences.map(occ => 
                `${occ.source === 'output' ? 'OutputFactory' : 'KnowledgeBaseFactory'} (${occ.configType})`
            ).join(' and ');
            return `Duplicate tool name '${toolName}' found in: ${sources}`;
        });

        const errorMessage = `Duplicate tool names detected. The application cannot start.\n\n${errorMessages.join('\n')}`;
        logger.error('Tool name validation failed - duplicates', { duplicates });
        throw new Error(errorMessage);
    }

    logger.info('Tool name validation passed - all tool names are unique and valid');
}
