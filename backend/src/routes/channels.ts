import { Request, Response } from "express";
import { db } from "../prismaClient";
import { Channel, ChannelInput, ChannelsResponse, ChannelNotificationSettings, ChannelUpdate, ChannelKnowledgeBase } from "../shared/types";
import { parsePageParams } from "../utility/pagination";
import { ChannelWithInputRelations, PrismaTransaction, ChannelWithRelations, ChannelWithNotificationSettingsRelations, RunHistoryActionType } from "../types/prisma";
import { IntegrationType } from "../shared/Integrations";
import { convertConfigTypeToInputConfigType, convertConfigTypeToOutputConfigType, convertConfigTypeToKnowledgeBaseConfigType, convertPrismaConfigToConfigInstance, convertPrismaOutputConfigToConfigInstance, convertPrismaKnowledgeBaseConfigToConfigInstance, convertPlainObjectToKnowledgeBaseConfigInstance } from "../utility/typeConverters";
import { ConfigInstance, ConfigType } from "../shared/Configs";
import { getInputConfigInclude, getOutputConfigInclude, getKnowledgeBaseConfigInclude } from "../utility/prismaIncludes";
import { INPUT_REGISTRY } from "../inputs/InputRegistry";
import { INTEGRATION_REGISTRY, isSystemIntegration } from "../integrations/abstract/IntegrationRegistry";
import { OutputFactory } from "../outputs/abstract/OutputFactory";
import { emitCacheInvalidationWithKey } from "../realtimeSocket";
import logger from "../logger";
import { KnowledgeBaseFactory } from "../knowledgeBase/abstract/KnowledgeBaseFactory";

async function createInputConfig(
    tx: PrismaTransaction,
    inputId: string,
    config: ChannelInput,
    userId: string
): Promise<void> {
    logger.debug('🔵 [INPUT CONFIG] config', { inputId, config: JSON.stringify(config, null, 2) });
    const input = INPUT_REGISTRY.find(input => input.configType === config.config.configType);
    if (!input) {
        throw new Error(`Input not found for integration type: ${config.config.configType}`);
    }
    await input.validateConfig(config.config, userId);
    await input.addInputToChannel(tx, inputId, config.config);
}

async function createOutputConfig(
    tx: PrismaTransaction,
    outputId: string,
    config: ConfigInstance,
    userId: string
): Promise<void> {
    const output = OutputFactory.OUTPUT_REGISTRY.get(convertConfigTypeToOutputConfigType(config.configType));
    if (!output) {
        throw new Error(`Output not found for integration type: ${config.configType}`);
    }
    await output().validateConfig(config, userId);
    await output().addOutputToChannel(tx, outputId, config);
}

async function createKnowledgeBaseConfig(
    tx: PrismaTransaction,
    knowledgeBaseId: string,
    config: ConfigInstance | any,
    userId: string
): Promise<void> {
    // Convert plain object to proper instance if needed
    const configInstance = convertPlainObjectToKnowledgeBaseConfigInstance(config);
    
    const knowledgeBase = KnowledgeBaseFactory.KNOWLEDGE_BASE_REGISTRY.get(convertConfigTypeToKnowledgeBaseConfigType(configInstance.configType));
    if (!knowledgeBase) {
        throw new Error(`Knowledge base not found for integration type: ${configInstance.configType}`);
    }
    await knowledgeBase().validateConfig(configInstance, userId);
    await knowledgeBase().addKnowledgeBaseToChannel(tx, knowledgeBaseId, configInstance);
}

async function validateUserOwnsIntegration(userId: string, integrationType: IntegrationType, integrationId: string): Promise<boolean> {
    // System integrations are not owned by a user
    if (isSystemIntegration(integrationType)) {
        return true;
    }
    const integration = INTEGRATION_REGISTRY.find(integration => integration.integrationType === integrationType);
    if (!integration) {
        throw new Error(`Integration ${integrationType} not found`);
    }
    const instances = await integration.getInstancesForUser(userId);
    return instances.some(instance => instance.id === integrationId);
}

async function upsertNotificationSettings(
    tx: PrismaTransaction,
    automationId: string,
    settings: ChannelNotificationSettings
): Promise<void> {
    await tx.automation_notification_settings.upsert({
        where: { automation_id: automationId },
        update: {
            enabled: settings.enabled,
            action_types: settings.actionTypes,
        },
        create: {
            automation_id: automationId,
            enabled: settings.enabled,
            action_types: settings.actionTypes,
        },
    });
}

// GET /channels - List all channels with pagination
export async function getUserChannels(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;

    // Parse pagination parameters (normalize to page/pageSize)
    const { page, pageSize, skip, take } = parsePageParams(req, 10, 100);

    // Optional filter by active status
    const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

    // Optional search by name
    const search = req.query.search as string | undefined;

    try {
        const prisma = db();

        const where = {
            user_id: userId,
            ...(isActive !== undefined && { is_active: isActive }),
            ...(search && { name: { contains: search, mode: 'insensitive' as const } })
        };

        // Get total count for pagination
        const total = await prisma.automations.count({ where });

        // Get paginated results
        const channels: ChannelWithRelations[] = await prisma.automations.findMany({
            where,
            include: {
                prompt: true,
                inputs: {
                    include: getInputConfigInclude()
                },
                output: {
                    include: getOutputConfigInclude()
                },
                knowledge_bases: {
                    include: getKnowledgeBaseConfigInclude()
                },
                notification_settings: true
            },
            orderBy: { created_at: 'desc' },
            skip,
            take
        });

        if (channels.length > 0 && !channels.some(channel => channel.output)) {
            throw new Error(`Channel output not found`);
        }

        // Transform the data to match frontend format
        const response: ChannelsResponse = {
            channels: channels.map(channel => transformChannelToFrontendFormat(channel)),
            pagination: {
                page,
                limit: pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
            }
        };

        res.status(200).json(response);
    } catch (error) {
        logger.error('Error fetching channels', { error, userId });
        res.status(500).json({ error: 'Failed to fetch channels' });
    }
}

// Type for raw SQL last event timestamp result
interface LastEventRow {
    automation_id: string;
    last_timestamp: Date;
}

// GET /channels/recent - Get recently modified channels with last event processed time
export async function getRecentChannels(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const limit = parseInt(req.query.limit as string) || 3;

    try {
        const prisma = db();

        // Run channels query and last event timestamps query in parallel
        const [channels, lastEventRows] = await Promise.all([
            // Query 1: Get recently modified channels (without run_history_records)
            prisma.automations.findMany({
                where: {
                    user_id: userId,
                },
            include: {
                prompt: true,
                inputs: {
                    include: getInputConfigInclude()
                },
                output: {
                    include: getOutputConfigInclude()
                },
                knowledge_bases: {
                    include: getKnowledgeBaseConfigInclude()
                },
            },
                orderBy: { updated_at: 'desc' },
                take: limit
            }) as Promise<ChannelWithRelations[]>,
            
            // Query 2: Get last event timestamps using raw SQL with MAX() aggregation
            // This is more efficient than correlated subqueries
            prisma.$queryRaw<LastEventRow[]>`
                SELECT rhr.automation_id, MAX(rhr.timestamp) as last_timestamp
                FROM run_history_records rhr
                INNER JOIN automations a ON rhr.automation_id = a.id
                WHERE a.user_id = ${userId}
                GROUP BY rhr.automation_id
            `
        ]);

        // Build a map from automation_id to last timestamp
        const lastEventMap = new Map<string, Date>();
        for (const row of lastEventRows) {
            lastEventMap.set(row.automation_id, row.last_timestamp);
        }

        // Transform the data to match frontend format with timestamps
        const response = channels.map(channel => {
            const lastEventTimestamp = lastEventMap.get(channel.id);
            return {
                ...transformChannelToFrontendFormat(channel),
                updatedAt: channel.updated_at.toISOString(),
                lastEventProcessedAt: lastEventTimestamp ? lastEventTimestamp.toISOString() : null,
            };
        });

        res.status(200).json(response);
    } catch (error) {
        logger.error('Error fetching recent channels', { error, userId });
        res.status(500).json({ error: 'Failed to fetch recent channels' });
    }
}

// GET /channels/:id - Get single channel by ID
export async function getUserChannel(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const channelId = req.params.id;

    try {
        const channel: ChannelWithRelations & ChannelWithNotificationSettingsRelations | null = await db().automations.findFirst({
            where: {
                id: channelId,
                user_id: userId
            },
            include: {
                prompt: true,
                inputs: {
                    include: getInputConfigInclude()
                },
                output: {
                    include: getOutputConfigInclude()
                },
                knowledge_bases: {
                    include: getKnowledgeBaseConfigInclude()
                },
                notification_settings: true
            }
        });

        if (!channel || !channel.output) {
            res.status(404).json({ error: 'Channel not found' });
            return;
        }

        // Transform the data to match frontend format
        const response: Channel = transformChannelToFrontendFormat(channel);

        res.status(200).json(response);
    } catch (error) {
        logger.error('Error fetching channel', { error, userId, channelId });
        res.status(500).json({ error: 'Failed to fetch channel' });
    }
}

// POST /channels - Create a new channel
export async function createChannel(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const { name, inputs, output, knowledgeBases, prompt, isActive = true, requireApproval = false, notificationSettings } = req.body as Channel;
    logger.debug("Output from frontend", { output: JSON.stringify(output, null, 2), userId });
    logger.debug("Inputs from frontend", { inputs: JSON.stringify(inputs, null, 2), userId });
    logger.debug("Knowledge bases from frontend", { knowledgeBases: JSON.stringify(knowledgeBases, null, 2), userId });
    logger.debug("Notification settings from frontend", { notificationSettings: JSON.stringify(notificationSettings, null, 2), userId });

    // Validate request
    if (!name || !inputs || inputs.length === 0 || !output || !prompt?.text) {
        res.status(400).json({ error: 'Invalid request: missing required fields' });
        return;
    }

    try {
        const prisma = db();

        // Create new channel
        const channel = await prisma.$transaction(async (tx) => {
            // Create channel
            const newChannel = await tx.automations.create({
                data: {
                    user_id: userId,
                    name,
                    is_active: isActive,
                    require_approval: requireApproval
                }
            });

            // Create prompt
            await tx.automation_prompts.create({
                data: {
                    automation_id: newChannel.id,
                    content: prompt.text
                }
            });

            // Create inputs
            for (const input of inputs) {
                const integrationType = input.config.integrationType
                if (!integrationType) {
                    throw new Error(`Unknown integration type: ${input.config.integrationType}`);
                }

                // Validate that user owns the integration (system integrations skip validation)
                const integrationId = input.config.integrationId;
                if (!integrationId && !isSystemIntegration(integrationType)) {
                    throw new Error(`Integration ID is required for ${input.config.integrationType}`);
                }

                const isOwner = await validateUserOwnsIntegration(userId, integrationType, integrationId || 'system');
                if (!isOwner) {
                    throw new Error(`Integration ${input.config.integrationType} not found or not owned by user`);
                }

                const newInput = await tx.automation_inputs.create({
                    data: {
                        automation_id: newChannel.id,
                        config_type: convertConfigTypeToInputConfigType(input.config.configType),
                        // System integrations use 'system' as a sentinel integration ID
                        integration_id: integrationId || 'system'
                    }
                });

                // Create config record if provided
                await createInputConfig(tx, newInput.id, input, userId);
            }

            // Create output
            const outputIntegrationType = output.config.integrationType;
            const outputConfigType = output.config.configType;

            const outputIntegrationId = output.config.integrationId;
            if (!outputIntegrationId) {
                throw new Error(`Integration ID is required for ${output.config.integrationType}`);
            }
            const isOwner = await validateUserOwnsIntegration(userId, outputIntegrationType, outputIntegrationId);
            if (!isOwner) {
                throw new Error(`Integration ${output.config.integrationType} not found or not owned by user`);
            }

            logger.debug("Output integration ID", { outputIntegrationId, userId });
            logger.debug("Output integration type", { outputIntegrationType, userId });
            logger.debug("Creating new output", { output: JSON.stringify(output, null, 2), userId });

            const newOutput = await tx.automation_outputs.create({
                data: {
                    automation_id: newChannel.id,
                    config_type: convertConfigTypeToOutputConfigType(outputConfigType),
                    integration_id: outputIntegrationId
                }
            });

            // Create config record if provided
            await createOutputConfig(tx, newOutput.id, output.config, userId);

            // Create knowledge bases if provided
            if (knowledgeBases && knowledgeBases.length > 0) {
                for (const kb of knowledgeBases) {
                    const integrationType = kb.config.integrationType;
                    if (!integrationType) {
                        throw new Error(`Unknown integration type: ${kb.config.integrationType}`);
                    }

                    // Validate that user owns the integration
                    const integrationId = kb.config.integrationId;
                    if (!integrationId) {
                        throw new Error(`Integration ID is required for ${kb.config.integrationType}`);
                    }

                    const isOwner = await validateUserOwnsIntegration(userId, integrationType, integrationId);
                    if (!isOwner) {
                        throw new Error(`Integration ${kb.config.integrationType} not found or not owned by user`);
                    }

                    const newKnowledgeBase = await tx.automation_knowledge_bases.create({
                        data: {
                            automation_id: newChannel.id,
                            config_type: convertConfigTypeToKnowledgeBaseConfigType(kb.config.configType),
                            integration_id: integrationId
                        }
                    });
                    
                    await createKnowledgeBaseConfig(tx, newKnowledgeBase.id, kb.config, userId);
                }
            }

            // Create notification settings if provided
            if (notificationSettings) {
                await upsertNotificationSettings(tx, newChannel.id, notificationSettings);
            }

            return newChannel;
        });

        const channelWithRelations: ChannelWithInputRelations | null = await prisma.automations.findFirst({
            where: { id: channel.id },
            include: {
                inputs: {
                    include: getInputConfigInclude()
                },
            }
        });

        if (!channelWithRelations) {
            throw new Error(`Channel not found: ${channel.id}`);
        }

        // Set up channel inputs (e.g., create webhooks for Figma)
        await setupChannelInputs(channelWithRelations);

        // Invalidate recent channels cache
        emitCacheInvalidationWithKey(userId, 'recentChannels');

        res.status(201).json({ success: true, id: channel.id });
    } catch (error) {
        logger.error('Error creating channel', { error, userId });
        res.status(500).json({ error: 'Failed to create channel', details: (error as Error).message });
    }
}

// PATCH /channels/:id - Update an existing channel
export async function updateChannel(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const channelId = req.params.id;
    const { name, inputs, output, knowledgeBases, prompt, isActive, requireApproval, notificationSettings } = req.body as Partial<ChannelUpdate>;

    try {
        const prisma = db();
        const existingChannel: ChannelWithInputRelations | null = await prisma.automations.findFirst({
            where: {
                id: channelId,
                user_id: userId
            },
            include: {
                inputs: {
                    include: getInputConfigInclude()
                },
            }
        });

        if (!existingChannel) {
            res.status(404).json({ error: 'Channel not found' });
            return;
        }

        // Update channel in transaction
        await prisma.$transaction(async (tx) => {
            // Update basic fields if provided
            if (name !== undefined || isActive !== undefined || requireApproval !== undefined) {
                await tx.automations.update({
                    where: { id: channelId },
                    data: {
                        ...(name !== undefined && { name }),
                        ...(isActive !== undefined && { is_active: isActive }),
                        ...(requireApproval !== undefined && { require_approval: requireApproval })
                    }
                });
            }

            // Update prompt if provided
            if (prompt?.text) {
                await tx.automation_prompts.upsert({
                    where: { automation_id: channelId },
                    update: { content: prompt.text },
                    create: {
                        automation_id: channelId,
                        content: prompt.text
                    }
                });
            }

            // Update inputs if provided
            if (inputs && inputs.length > 0) {
                // Delete old inputs (configs cascade delete)
                await tx.automation_inputs.deleteMany({
                    where: { automation_id: channelId }
                });

                // Tear down old inputs (e.g., delete webhooks for Figma)
                await tearDownChannelInputs(existingChannel);

                // Create new inputs
                for (const input of inputs) {
                    const integrationType = input.config.integrationType;
                    if (!integrationType) {
                        throw new Error(`Unknown integration type: ${input.config.integrationType}`);
                    }

                    // Validate that user owns the integration (system integrations skip validation)
                    const integrationId = input.config.integrationId;
                    if (!integrationId && !isSystemIntegration(integrationType)) {
                        throw new Error(`Integration ID is required for ${input.config.integrationType}`);
                    }

                    const isOwner = await validateUserOwnsIntegration(userId, integrationType, integrationId || 'system');
                    if (!isOwner) {
                        throw new Error(`Integration ${input.config.integrationType} not found or not owned by user`);
                    }

                    const newInput = await tx.automation_inputs.create({
                        data: {
                            automation_id: channelId,
                            config_type: convertConfigTypeToInputConfigType(input.config.configType),
                            // System integrations use 'system' as a sentinel integration ID
                            integration_id: integrationId || 'system'
                        }
                    });

                    // Create config record if provided
                    await createInputConfig(tx, newInput.id, input, userId);
                }
            }

            // Update output if provided
            if (output) {
                const outputIntegrationType = output.config.integrationType;
                if (!outputIntegrationType) {
                    throw new Error(`Unknown integration type: ${output.config.integrationType}`);
                }

                const outputConfigType = output.config.configType;
                const outputIntegrationId = output.config.integrationId;
                if (!outputIntegrationId) {
                    throw new Error(`Integration ID is required for ${output.config.integrationType}`);
                }

                const isOwner = await validateUserOwnsIntegration(userId, outputIntegrationType, outputIntegrationId);
                if (!isOwner) {
                    throw new Error(`Integration ${output.config.integrationType} not found or not owned by user`);
                }

                // Delete old output (configs cascade delete)
                const existingOutput = await tx.automation_outputs.findUnique({
                    where: { automation_id: channelId }
                });
                if (existingOutput) {
                    await tx.automation_outputs.delete({
                        where: { automation_id: channelId }
                    });
                }

                // Create new output
                const newOutput = await tx.automation_outputs.create({
                    data: {
                        automation_id: channelId,
                        config_type: convertConfigTypeToOutputConfigType(outputConfigType),
                        integration_id: outputIntegrationId
                    }
                });

                // Create config record if provided
                await createOutputConfig(tx, newOutput.id, output.config, userId);
            }

            // Update knowledge bases if provided
            if (knowledgeBases !== undefined) {
                // Delete old knowledge bases if exists (configs cascade delete)
                await tx.automation_knowledge_bases.deleteMany({
                    where: { automation_id: channelId }
                });

                // Create new knowledge bases if provided
                if (knowledgeBases.length > 0) {
                    for (const kb of knowledgeBases) {
                        const integrationType = kb.config.integrationType;
                        if (!integrationType) {
                            throw new Error(`Unknown integration type: ${kb.config.integrationType}`);
                        }

                        // Validate that user owns the integration
                        const integrationId = kb.config.integrationId;
                        if (!integrationId) {
                            throw new Error(`Integration ID is required for ${kb.config.integrationType}`);
                        }

                        const isOwner = await validateUserOwnsIntegration(userId, integrationType, integrationId);
                        if (!isOwner) {
                            throw new Error(`Integration ${kb.config.integrationType} not found or not owned by user`);
                        }

                        const newKnowledgeBase = await tx.automation_knowledge_bases.create({
                            data: {
                                automation_id: channelId,
                                config_type: convertConfigTypeToKnowledgeBaseConfigType(kb.config.configType),
                                integration_id: integrationId
                            }
                        });

                        // Create config record
                        await createKnowledgeBaseConfig(tx, newKnowledgeBase.id, kb.config, userId);
                    }
                }
            }

            // Update notification settings if provided
            if (notificationSettings) {
                await upsertNotificationSettings(tx, channelId, notificationSettings);
            }
        });

        const channelWithInputRelations: ChannelWithInputRelations | null = await prisma.automations.findFirst({
            where: { id: channelId },
            include: {
                inputs: {
                    include: getInputConfigInclude()
                },
            }
        });

        if (!channelWithInputRelations) {
            throw new Error(`Channel not found: ${channelId}`);
        }

        // Set up channel inputs (e.g., create webhooks for Figma)
        await setupChannelInputs(channelWithInputRelations);

        // Invalidate recent channels cache
        emitCacheInvalidationWithKey(userId, 'recentChannels');

        res.status(200).json({ success: true, id: channelId });
    } catch (error) {
        logger.error('Error updating channel', { error, userId, channelId });
        res.status(500).json({ error: 'Failed to update channel', details: (error as Error).message });
    }
}

// DELETE /channels/:id - Delete an channel
export async function deleteChannel(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const channelId = req.params.id;

    try {
        const prisma = db();

        // Check if channel exists and belongs to user
        const existingChannel: ChannelWithInputRelations | null = await prisma.automations.findFirst({
            where: {
                id: channelId,
                user_id: userId
            },
            include: {
                inputs: {
                    include: getInputConfigInclude()
                },
            }
        });

        if (!existingChannel) {
            res.status(404).json({ error: 'Channel not found' });
            return;
        }

        // Tear down channel inputs (e.g., delete webhooks for Figma)
        await tearDownChannelInputs(existingChannel);

        // Delete channel (cascade will delete related records)
        await prisma.automations.delete({
            where: { id: channelId }
        });

        // Invalidate recent channels cache
        emitCacheInvalidationWithKey(userId, 'recentChannels');

        res.status(200).json({ success: true, message: 'Channel deleted successfully' });
    } catch (error) {
        logger.error('Error deleting channel', { error, userId, channelId });
        res.status(500).json({ error: 'Failed to delete channel', details: (error as Error).message });
    }
}

// Helper function to transform ChannelWithRelations to frontend Channel format
function transformChannelToFrontendFormat(channel: ChannelWithRelations & Partial<ChannelWithNotificationSettingsRelations>): Channel {
    if (!channel.output) {
        throw new Error(`Channel output not found for channel ${channel.id}`);
    }

    return {
        id: channel.id,
        name: channel.name,
        isActive: channel.is_active,
        requireApproval: channel.require_approval ?? false,
        prompt: channel.prompt ? { text: channel.prompt.content } : { text: '' },
        inputs: channel.inputs.map(input => ({
            id: input.id,
            config: convertPrismaConfigToConfigInstance(input)
        })),
        output: {
            id: channel.output.id,
            config: convertPrismaOutputConfigToConfigInstance(channel.output),
        },
        knowledgeBases: (channel as any).knowledge_bases && (channel as any).knowledge_bases.length > 0 ? (channel as any).knowledge_bases.map((kb: any) => ({
            id: kb.id,
            config: convertPrismaKnowledgeBaseConfigToConfigInstance(kb),
        })) : undefined,
        notificationSettings: channel.notification_settings ? {
            enabled: channel.notification_settings.enabled,
            actionTypes: channel.notification_settings.action_types,
        } : undefined,
        updatedAt: channel.updated_at.toISOString(),
    };
}

async function setupChannelInputs(channel: ChannelWithInputRelations): Promise<void> {
    for (const input of channel.inputs) {
        try {
            // Convert prisma config to shared config instance to get integration type
            const configInstance = convertPrismaConfigToConfigInstance(input);
            const integrationType = configInstance.integrationType;

            // Find the integration from the registry
            const integration = INTEGRATION_REGISTRY.find(
                (int) => int.integrationType === integrationType
            );

            if (integration) {
                await integration.setupChannelInput(input.integration_id, input);
                logger.info(
                    `✅ Setup completed for ${input.config_type} input (ID: ${input.id})`,
                    { configType: input.config_type, inputId: input.id, integrationId: input.integration_id }
                );
            } else {
                logger.warn(
                    `⚠️  No integration found for ${integrationType} (config: ${input.config_type}). Skipping setup.`,
                    { integrationType, configType: input.config_type, inputId: input.id }
                );
            }
        } catch (error) {
            logger.error(
                `❌ Error setting up ${input.config_type} input (ID: ${input.id})`,
                { error, configType: input.config_type, inputId: input.id }
            );
        }
    }
}

/**
 * Tears down setup for all inputs in an channel by calling teardownChannelInput on each integration.
 * Called before an channel is deleted.
 */
async function tearDownChannelInputs(channel: ChannelWithInputRelations): Promise<void> {
    for (const input of channel.inputs) {
        try {
            // Convert prisma config to shared config instance to get integration type
            const configInstance = convertPrismaConfigToConfigInstance(input);
            const integrationType = configInstance.integrationType;

            // Find the integration from the registry
            const integration = INTEGRATION_REGISTRY.find(
                (int) => int.integrationType === integrationType
            );

            if (integration) {
                await integration.teardownChannelInput(input.integration_id, input);
                logger.info(
                    `✅ Teardown completed for ${input.config_type} input`,
                    { configType: input.config_type, inputId: input.id, integrationId: input.integration_id }
                );
            } else {
                logger.warn(
                    `⚠️  No integration found for ${integrationType} (config: ${input.config_type}). Skipping teardown.`,
                    { integrationType, configType: input.config_type, inputId: input.id }
                );
            }
        } catch (error) {
            logger.error(
                `❌ Error tearing down ${input.config_type}`,
                { error, configType: input.config_type, inputId: input.id }
            );
        }
    }
}