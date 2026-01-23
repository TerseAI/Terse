import { PrismaClient } from '@prisma/client';
import { getToolsThatRequireApprovals } from '../src/tools/availableTools';
import { ConfigType } from '../src/shared/Configs';
import logger from '../src/logger';

const prisma = new PrismaClient();

async function migrateToolApprovals() {
    logger.info('Starting migration: Auto-select write-only tools for agents with require_approval=true');

    try {
        // Find all automations where require_approval = true
        const automations = await prisma.automations.findMany({
            where: {
                require_approval: true,
            },
            include: {
                outputs: true,
                knowledge_bases: true,
                tool_approvals: true, // Check if already migrated
            },
        });

        logger.info(`Found ${automations.length} automations with require_approval=true`);

        let migratedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const automation of automations) {
            try {
                // Skip if already has tool approvals (already migrated)
                if (automation.tool_approvals && automation.tool_approvals.length > 0) {
                    logger.debug(`Skipping automation ${automation.id} - already has tool approvals`);
                    skippedCount++;
                    continue;
                }

                // Get configured outputs and knowledge bases
                const outputConfigTypes: ConfigType[] = automation.outputs.map(
                    output => output.config_type as ConfigType
                );
                const knowledgeBaseConfigTypes: ConfigType[] = (automation.knowledge_bases || []).map(
                    kb => kb.config_type as ConfigType
                );

                if (outputConfigTypes.length === 0) {
                    logger.warn(`Skipping automation ${automation.id} - no outputs configured`);
                    skippedCount++;
                    continue;
                }

                // Get write-only tools that require approval for this automation's configuration
                const toolsThatRequireApprovals = getToolsThatRequireApprovals(
                    outputConfigTypes,
                    knowledgeBaseConfigTypes
                );
                const writeOnlyTools = toolsThatRequireApprovals.map(tool => tool.name);

                if (writeOnlyTools.length === 0) {
                    logger.debug(`Skipping automation ${automation.id} - no write-only tools found`);
                    skippedCount++;
                    continue;
                }

                // Insert tool approvals
                await prisma.automation_tool_approvals.createMany({
                    data: writeOnlyTools.map(toolName => ({
                        automation_id: automation.id,
                        tool_name: toolName,
                    })),
                    skipDuplicates: true, // In case of race conditions
                });

                logger.info(
                    `Migrated automation ${automation.id}: Selected ${writeOnlyTools.length} write-only tools`,
                    { automationId: automation.id, toolNames: writeOnlyTools }
                );
                migratedCount++;
            } catch (error) {
                logger.error(`Error migrating automation ${automation.id}`, {
                    error,
                    automationId: automation.id,
                });
                errorCount++;
            }
        }

        logger.info('Migration completed', {
            total: automations.length,
            migrated: migratedCount,
            skipped: skippedCount,
            errors: errorCount,
        });
    } catch (error) {
        logger.error('Migration failed', { error });
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run migration
migrateToolApprovals()
    .then(() => {
        logger.info('Migration script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        logger.error('Migration script failed', { error });
        process.exit(1);
    });
