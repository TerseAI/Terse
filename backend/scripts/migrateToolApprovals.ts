/**
 * Migration script to convert existing require_approval boolean to granular tool approval settings.
 * 
 * This script:
 * 1. Finds all automations with require_approval = true
 * 2. Loads their outputs and knowledge bases to determine available tools
 * 3. Creates tool approval settings for all non-readonly tools
 * 
 * Run with: npx ts-node backend/scripts/migrateToolApprovals.ts
 */

import { db } from '../src/prismaClient';
import { OutputFactory } from '../src/outputs/abstract/OutputFactory';
import { KnowledgeBaseFactory } from '../src/knowledgeBase/abstract/KnowledgeBaseFactory';
import { getInputConfigInclude, getOutputConfigInclude, getKnowledgeBaseConfigInclude } from '../src/utility/prismaIncludes';
import { convertPrismaOutputConfigToConfigInstance, convertPrismaKnowledgeBaseConfigToConfigInstance } from '../src/utility/typeConverters';
import logger from '../src/logger';

async function getAllToolsForChannel(channel: any): Promise<Array<{ name: string; isReadOnly: boolean }>> {
    const tools: Array<{ name: string; isReadOnly: boolean }> = [];

    // Get tools from outputs
    for (const output of channel.outputs || []) {
        try {
            const outputConfig = convertPrismaOutputConfigToConfigInstance(output);
            const outputInstance = OutputFactory.createOutputFromConfig(outputConfig);
            
            for (const entry of outputInstance.toolbox) {
                tools.push({
                    name: entry.tool.name,
                    isReadOnly: entry.isReadOnly,
                });
            }
        } catch (error) {
            logger.warn(`Failed to load tools from output ${output.id}`, { error, outputId: output.id });
        }
    }

    // Get tools from knowledge bases
    for (const kb of channel.knowledge_bases || []) {
        try {
            const kbConfig = convertPrismaKnowledgeBaseConfigToConfigInstance(kb);
            const kbInstance = KnowledgeBaseFactory.createKnowledgeBaseFromConfig(kbConfig);
            
            for (const entry of kbInstance.toolbox) {
                tools.push({
                    name: entry.tool.name,
                    isReadOnly: entry.isReadOnly,
                });
            }
        } catch (error) {
            logger.warn(`Failed to load tools from knowledge base ${kb.id}`, { error, kbId: kb.id });
        }
    }

    // Remove duplicates (same tool name)
    const uniqueTools = new Map<string, { name: string; isReadOnly: boolean }>();
    for (const tool of tools) {
        if (!uniqueTools.has(tool.name)) {
            uniqueTools.set(tool.name, tool);
        }
    }

    return Array.from(uniqueTools.values());
}

async function migrateToolApprovalSettings() {
    const prisma = db();
    
    logger.info('Starting tool approval settings migration...');

    // Find all automations with require_approval = true
    const automations = await prisma.automations.findMany({
        where: { require_approval: true },
        include: {
            outputs: {
                include: getOutputConfigInclude(),
            },
            knowledge_bases: {
                include: getKnowledgeBaseConfigInclude(),
            },
        },
    });

    logger.info(`Found ${automations.length} automations with require_approval = true`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const automation of automations) {
        try {
            // Check if tool approval settings already exist
            const existingSettings = await prisma.automation_tool_approval_settings.findFirst({
                where: { automation_id: automation.id },
            });

            if (existingSettings) {
                logger.info(`Skipping automation ${automation.id} - tool approval settings already exist`);
                skippedCount++;
                continue;
            }

            // Get all tools for this channel
            const allTools = await getAllToolsForChannel(automation);

            if (allTools.length === 0) {
                logger.warn(`No tools found for automation ${automation.id}, skipping`);
                skippedCount++;
                continue;
            }

            // Create approval settings for all non-readonly tools
            const settings = allTools
                .filter(tool => !tool.isReadOnly)
                .map(tool => ({
                    automation_id: automation.id,
                    tool_name: tool.name,
                    requires_approval: true,
                }));

            if (settings.length > 0) {
                await prisma.automation_tool_approval_settings.createMany({
                    data: settings,
                    skipDuplicates: true,
                });

                logger.info(`Migrated automation ${automation.id}: ${settings.length} tools require approval`);
                migratedCount++;
            } else {
                logger.info(`No writable tools found for automation ${automation.id}, skipping`);
                skippedCount++;
            }
        } catch (error) {
            logger.error(`Error migrating automation ${automation.id}`, { error });
            errorCount++;
        }
    }

    logger.info('Migration completed', {
        total: automations.length,
        migrated: migratedCount,
        skipped: skippedCount,
        errors: errorCount,
    });
}

// Run migration
migrateToolApprovalSettings()
    .then(() => {
        logger.info('Migration script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        logger.error('Migration script failed', { error });
        process.exit(1);
    });
