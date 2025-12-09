import { Request, Response } from "express";
import { db } from "../prismaClient";
import { Channel, ChannelInput, ChannelsResponse, ChannelNotificationSettings, ChannelUpdate } from "../shared/types";
import { parsePageParams } from "../utility/pagination";
import chalk from "chalk";
import { ChannelWithInputRelations, PrismaTransaction, ChannelWithRelations, ChannelWithNotificationSettingsRelations } from "../types/prisma";
import { IntegrationType } from "../shared/Integrations";
import { convertConfigTypeToInputConfigType, convertConfigTypeToOutputConfigType, convertPrismaConfigToConfigInstance, convertPrismaOutputConfigToConfigInstance } from "../utility/typeConverters";
import { ConfigInstance } from "../shared/Configs";
import { getInputConfigInclude, getOutputConfigInclude } from "../utility/prismaIncludes";
import { INPUT_REGISTRY } from "../inputs/InputRegistry";
import { INTEGRATION_REGISTRY } from "../integrations/abstract/IntegrationRegistry";
import { OutputFactory } from "../outputs/abstract/OutputFactory";
import { emitCacheInvalidationWithKey } from "../realtimeSocket";

async function createInputConfig(
    tx: PrismaTransaction,
    inputId: string,
    config: ChannelInput
): Promise<void> {
    console.log(chalk.cyan('🔵 [INPUT CONFIG] config:', JSON.stringify(config, null, 2)));
    const input = INPUT_REGISTRY.find(input => input.configType === config.config.configType);
    if (!input) {
        throw new Error(`Input not found for integration type: ${config.config.configType}`);
    }
    await input.addInputToChannel(tx, inputId, config.config);
}

async function createOutputConfig(
    tx: any,
    outputId: string,
    config: ConfigInstance
): Promise<void> {
    const output = OutputFactory.OUTPUT_REGISTRY.get(convertConfigTypeToOutputConfigType(config.configType));
    if (!output) {
        throw new Error(`Output not found for integration type: ${config.configType}`);
    }
    await output().addOutputToChannel(tx, outputId, config);
}

async function validateUserOwnsIntegration(userId: string, integrationType: IntegrationType, integrationId: string): Promise<boolean> {
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
        console.error('Error fetching channels:', error);
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
        console.error('Error fetching recent channels:', error);
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
        console.error('Error fetching channel:', error);
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
    const { name, inputs, output, prompt, isActive = true, notificationSettings } = req.body as ChannelUpdate;
    console.log(chalk.green("Output from frontend:"), chalk.yellow(JSON.stringify(output, null, 2)));
    console.log(chalk.blue("Inputs from frontend:"), chalk.yellow(JSON.stringify(inputs, null, 2)));
    console.log(chalk.magenta("Notification settings from frontend:"), chalk.yellow(JSON.stringify(notificationSettings, null, 2)));

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
                    is_active: isActive
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

                // Validate that user owns the integration
                const integrationId = input.config.integrationId;
                if (!integrationId) {
                    throw new Error(`Integration ID is required for ${input.config.integrationType}`);
                }

                const isOwner = await validateUserOwnsIntegration(userId, integrationType, integrationId);
                if (!isOwner) {
                    throw new Error(`Integration ${input.config.integrationType} not found or not owned by user`);
                }

                const newInput = await tx.automation_inputs.create({
                    data: {
                        automation_id: newChannel.id,
                        config_type: convertConfigTypeToInputConfigType(input.config.configType),
                        integration_id: integrationId
                    }
                });

                // Create config record if provided
                await createInputConfig(tx, newInput.id, input);
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

            console.log(chalk.green("Output integration ID:"), chalk.yellow(outputIntegrationId));

            console.log(chalk.green("Output integration type:"), chalk.yellow(outputIntegrationType));

            console.log(chalk.green("Creating new output:"), chalk.yellow(JSON.stringify(output, null, 2)));

            const newOutput = await tx.automation_outputs.create({
                data: {
                    automation_id: newChannel.id,
                    config_type: convertConfigTypeToOutputConfigType(outputConfigType),
                    integration_id: outputIntegrationId
                }
            });

            // Create config record if provided
            await createOutputConfig(tx, newOutput.id, output.config);

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
        console.error('Error creating channel:', error);
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
    const { name, inputs, output, prompt, isActive, notificationSettings } = req.body as Partial<ChannelUpdate>;

    try {
        const prisma = db();

        // Check if channel exists and belongs to user
        const existingChannel = await prisma.automations.findFirst({
            where: {
                id: channelId,
                user_id: userId
            }
        });

        if (!existingChannel) {
            res.status(404).json({ error: 'Channel not found' });
            return;
        }

        // Update channel in transaction
        await prisma.$transaction(async (tx) => {
            // Update basic fields if provided
            if (name !== undefined || isActive !== undefined) {
                await tx.automations.update({
                    where: { id: channelId },
                    data: {
                        ...(name !== undefined && { name }),
                        ...(isActive !== undefined && { is_active: isActive })
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

                // Create new inputs
                for (const input of inputs) {
                    const integrationType = input.config.integrationType;
                    if (!integrationType) {
                        throw new Error(`Unknown integration type: ${input.config.integrationType}`);
                    }

                    // Validate that user owns the integration
                    const integrationId = input.config.integrationId;
                    if (!integrationId) {
                        throw new Error(`Integration ID is required for ${input.config.integrationType}`);
                    }

                    const isOwner = await validateUserOwnsIntegration(userId, integrationType, integrationId);
                    if (!isOwner) {
                        throw new Error(`Integration ${input.config.integrationType} not found or not owned by user`);
                    }

                    const newInput = await tx.automation_inputs.create({
                        data: {
                            automation_id: channelId,
                            config_type: convertConfigTypeToInputConfigType(input.config.configType),
                            integration_id: integrationId
                        }
                    });

                    // Create config record if provided
                    await createInputConfig(tx, newInput.id, input);
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
                await createOutputConfig(tx, newOutput.id, output.config);
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
        console.error('Error updating channel:', error);
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
        console.error('Error deleting channel:', error);
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
        prompt: channel.prompt ? { text: channel.prompt.content } : { text: '' },
        inputs: channel.inputs.map(input => ({
            id: input.id,
            config: convertPrismaConfigToConfigInstance(input)
        })),
        output: {
            id: channel.output.id,
            config: convertPrismaOutputConfigToConfigInstance(channel.output),
        },
        notificationSettings: channel.notification_settings ? {
            enabled: channel.notification_settings.enabled,
            actionTypes: channel.notification_settings.action_types as any[], // RunHistoryActionType[]
        } : undefined,
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
                console.log(
                    chalk.green(
                        `✅ Setup completed for ${input.config_type} input (ID: ${input.id})`
                    )
                );
            } else {
                console.log(
                    chalk.yellow(
                        `⚠️  No integration found for ${integrationType} (config: ${input.config_type}). Skipping setup.`
                    )
                );
            }
        } catch (error) {
            console.error(
                chalk.red(
                    `❌ Error setting up ${input.config_type} input (ID: ${input.id}):`
                ),
                error
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
                console.log(
                    chalk.green(
                        `✅ Teardown completed for ${input.config_type} input`
                    )
                );
            } else {
                console.log(
                    chalk.yellow(
                        `⚠️  No integration found for ${integrationType} (config: ${input.config_type}). Skipping teardown.`
                    )
                );
            }
        } catch (error) {
            console.error(
                chalk.red(
                    `❌ Error tearing down ${input.config_type}:`
                ),
                error
            );
        }
    }
}