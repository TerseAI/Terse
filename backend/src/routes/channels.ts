import { Request, Response } from "express";
import { db } from "../prismaClient";
import { Agent, AgentInput, AgentsResponse, AgentNotificationSettings, AgentUpdate, AgentKnowledgeBase } from "../shared/types";
import { parsePageParams } from "../utility/pagination";
import { AgentWithInputRelations, PrismaTransaction, AgentWithRelations, AgentWithNotificationSettingsRelations, RunHistoryActionType } from "../types/prisma";
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

export type AgentDraft = Omit<Agent, "id"> & { id?: string };

async function createInputConfig(
    tx: PrismaTransaction,
    inputId: string,
    config: AgentInput,
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
    await output().addOutputToAgent(tx, outputId, config);
}

async function createKnowledgeBaseConfig(
    tx: PrismaTransaction,
    knowledgeBaseId: string,
    config: ConfigInstance,
    userId: string
): Promise<void> {
    // Convert plain object to proper instance if needed
    const configInstance = convertPlainObjectToKnowledgeBaseConfigInstance(config);
    
    const knowledgeBase = KnowledgeBaseFactory.KNOWLEDGE_BASE_REGISTRY.get(convertConfigTypeToKnowledgeBaseConfigType(configInstance.configType));
    if (!knowledgeBase) {
        throw new Error(`Knowledge base not found for integration type: ${configInstance.configType}`);
    }
    await knowledgeBase().validateConfig(configInstance, userId);
    await knowledgeBase().addKnowledgeBaseToAgent(tx, knowledgeBaseId, configInstance);
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
    agentId: string,
    settings: AgentNotificationSettings
): Promise<void> {
    await tx.automation_notification_settings.upsert({
        where: { automation_id: agentId },
        update: {
            enabled: settings.enabled,
            action_types: settings.actionTypes,
        },
        create: {
            automation_id: agentId,
            enabled: settings.enabled,
            action_types: settings.actionTypes,
        },
    });
}

export async function applyAgentForUser(userId: string, draft: AgentDraft): Promise<{ id: string }> {
    const { name, inputs, outputs, knowledgeBases, prompt, isActive = true, requireApproval = false, notificationSettings } = draft;
    
    logger.debug("Outputs from frontend", { outputs: JSON.stringify(outputs, null, 2), userId });
    logger.debug("Inputs from frontend", { inputs: JSON.stringify(inputs, null, 2), userId });
    logger.debug("Knowledge bases from frontend", { knowledgeBases: JSON.stringify(knowledgeBases, null, 2), userId });
    logger.debug("Notification settings from frontend", { notificationSettings: JSON.stringify(notificationSettings, null, 2), userId });

    // Validate request
    if (!name || !inputs || inputs.length === 0 || !outputs || outputs.length === 0 || !prompt?.text) {
        throw new Error('Invalid request: missing required fields');
    }

    const prisma = db();

    // Create new agent
    const agent = await prisma.$transaction(async (tx) => {
        // Create agent
        const newAgent = await tx.automations.create({
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
                automation_id: newAgent.id,
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
                    automation_id: newAgent.id,
                    config_type: convertConfigTypeToInputConfigType(input.config.configType),
                    // System integrations use 'system' as a sentinel integration ID
                    integration_id: integrationId || 'system'
                }
            });

            // Create config record if provided
            await createInputConfig(tx, newInput.id, input, userId);
        }

        // Create outputs
        for (const output of outputs) {
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
                    automation_id: newAgent.id,
                    config_type: convertConfigTypeToOutputConfigType(outputConfigType),
                    integration_id: outputIntegrationId
                }
            });

            // Create config record if provided
            await createOutputConfig(tx, newOutput.id, output.config, userId);
        }

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
                        automation_id: newAgent.id,
                        config_type: convertConfigTypeToKnowledgeBaseConfigType(kb.config.configType),
                        integration_id: integrationId
                    }
                });
                
                await createKnowledgeBaseConfig(tx, newKnowledgeBase.id, kb.config, userId);
            }
        }

        // Create notification settings if provided
        if (notificationSettings) {
            await upsertNotificationSettings(tx, newAgent.id, notificationSettings);
        }

        return newAgent;
    });

    const agentWithRelations: AgentWithInputRelations | null = await prisma.automations.findFirst({
        where: { id: agent.id },
        include: {
            inputs: {
                include: getInputConfigInclude()
            },
        }
    });

    if (!agentWithRelations) {
        throw new Error(`Agent not found: ${agent.id}`);
    }

    // Set up agent inputs (e.g., create webhooks for Figma)
    await setupAgentInputs(agentWithRelations);

    // Invalidate recent agents cache
    emitCacheInvalidationWithKey(userId, 'recentChannels');

    return { id: agent.id };
}

export async function updateAgentForUser(
    userId: string,
    agentId: string,
    update: Partial<AgentUpdate>
): Promise<{ id: string }> {
    const { name, inputs, outputs, knowledgeBases, prompt, isActive, requireApproval, notificationSettings } = update;

    const prisma = db();
    const existingAgent: AgentWithInputRelations | null = await prisma.automations.findFirst({
        where: {
            id: agentId,
            user_id: userId
        },
        include: {
            inputs: {
                include: getInputConfigInclude()
            },
        }
    });

    if (!existingAgent) {
        throw new Error('Agent not found');
    }

    // Update channel in transaction
    await prisma.$transaction(async (tx) => {
        // Update basic fields if provided
        if (name !== undefined || isActive !== undefined || requireApproval !== undefined) {
            await tx.automations.update({
                where: { id: agentId },
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
                where: { automation_id: agentId },
                update: { content: prompt.text },
                create: {
                    automation_id: agentId,
                    content: prompt.text
                }
            });
        }

        // Update inputs if provided
        if (inputs && inputs.length > 0) {
            // Delete old inputs (configs cascade delete)
            await tx.automation_inputs.deleteMany({
                where: { automation_id: agentId }
            });

            // Tear down old inputs (e.g., delete webhooks for Figma)
            await tearDownAgentInputs(existingAgent);

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
                        automation_id: agentId,
                        config_type: convertConfigTypeToInputConfigType(input.config.configType),
                        // System integrations use 'system' as a sentinel integration ID
                        integration_id: integrationId || 'system'
                    }
                });

                // Create config record if provided
                await createInputConfig(tx, newInput.id, input, userId);
            }
        }

        // Update outputs if provided
        if (outputs && outputs.length > 0) {
            // Delete old outputs (configs cascade delete)
            await tx.automation_outputs.deleteMany({
                where: { automation_id: agentId }
            });

            // Create new outputs
            for (const output of outputs) {
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

                // Create new output
                const newOutput = await tx.automation_outputs.create({
                    data: {
                        automation_id: agentId,
                        config_type: convertConfigTypeToOutputConfigType(outputConfigType),
                        integration_id: outputIntegrationId
                    }
                });

                // Create config record if provided
                await createOutputConfig(tx, newOutput.id, output.config, userId);
            }
        }

        // Update knowledge bases if provided
        if (knowledgeBases !== undefined) {
            // Delete old knowledge bases if exists (configs cascade delete)
            await tx.automation_knowledge_bases.deleteMany({
                where: { automation_id: agentId }
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
                            automation_id: agentId,
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
            await upsertNotificationSettings(tx, agentId, notificationSettings);
        }
    });

    const agentWithInputRelations: AgentWithInputRelations | null = await prisma.automations.findFirst({
        where: { id: agentId },
        include: {
            inputs: {
                include: getInputConfigInclude()
            },
        }
    });

    if (!agentWithInputRelations) {
        throw new Error(`Agent not found: ${agentId}`);
    }

    // Set up agent inputs (e.g., create webhooks for Figma)
    await setupAgentInputs(agentWithInputRelations);

    // Invalidate recent agents cache
    emitCacheInvalidationWithKey(userId, 'recentChannels');

    return { id: agentId };
}

// GET /channels - List all agents with pagination
export async function getUserAgents(req: Request, res: Response) {
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
        const agents: AgentWithRelations[] = await prisma.automations.findMany({
            where,
            include: {
                prompt: true,
                inputs: {
                    include: getInputConfigInclude()
                },
                outputs: {
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
        if (agents.length > 0 && !agents.some(agent => agent.outputs && agent.outputs.length > 0)) {
            throw new Error(`Agent outputs not found`);
        }


        // Transform the data to match frontend format
        const response: AgentsResponse = {
            agents: agents.map(agent => transformAgentToFrontendFormat(agent)),
            pagination: {
                page,
                limit: pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
            }
        };

        res.status(200).json(response);
    } catch (error) {
        logger.error('Error fetching agents', { error, userId });
        res.status(500).json({ error: 'Failed to fetch agents' });
    }
}

// Type for raw SQL last event timestamp result
interface LastEventRow {
    automation_id: string;
    last_timestamp: Date;
}

// GET /channels/recent - Get recently modified agents with last event processed time
export async function getRecentAgents(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const limit = parseInt(req.query.limit as string) || 3;

    try {
        const prisma = db();

        // Run agents query and last event timestamps query in parallel
        const [agents, lastEventRows] = await Promise.all([
            // Query 1: Get recently modified agents (without run_history_records)
            prisma.automations.findMany({
                where: {
                    user_id: userId,
                },
            include: {
                prompt: true,
                inputs: {
                    include: getInputConfigInclude()
                },
                outputs: {
                    include: getOutputConfigInclude()
                },
                knowledge_bases: {
                    include: getKnowledgeBaseConfigInclude()
                },
            },
                orderBy: { updated_at: 'desc' },
                take: limit
            }) as Promise<AgentWithRelations[]>,
            
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
        const response = agents.map(agent => {
            const lastEventTimestamp = lastEventMap.get(agent.id);
            return {
                ...transformAgentToFrontendFormat(agent),
                updatedAt: agent.updated_at.toISOString(),
                lastEventProcessedAt: lastEventTimestamp ? lastEventTimestamp.toISOString() : null,
            };
        });

        res.status(200).json(response);
    } catch (error) {
        logger.error('Error fetching recent agents', { error, userId });
        res.status(500).json({ error: 'Failed to fetch recent agents' });
    }
}

// GET /channels/:id - Get single agent by ID
export async function getUserAgent(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const agentId = req.params.id;

    try {
        const agent: AgentWithRelations & AgentWithNotificationSettingsRelations | null = await db().automations.findFirst({
            where: {
                id: agentId,
                user_id: userId
            },
            include: {
                prompt: true,
                inputs: {
                    include: getInputConfigInclude()
                },
                outputs: {
                    include: getOutputConfigInclude()
                },
                knowledge_bases: {
                    include: getKnowledgeBaseConfigInclude()
                },
                notification_settings: true
            }
        });

        if (!agent || !agent.outputs || agent.outputs.length === 0) {
            res.status(404).json({ error: 'Agent not found' });
            return;
        }

        // Transform the data to match frontend format
        const response: Agent = transformAgentToFrontendFormat(agent);

        res.status(200).json(response);
    } catch (error) {
        logger.error('Error fetching agent', { error, userId, agentId });
        res.status(500).json({ error: 'Failed to fetch agent' });
    }
}

// POST /channels - Create a new agent
export async function createAgent(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const { name, inputs, outputs, knowledgeBases, prompt, isActive = true, requireApproval = false, notificationSettings } = req.body as Agent;

    try {
        const { id } = await applyAgentForUser(userId, {
            name,
            inputs,
            outputs,
            knowledgeBases,
            prompt,
            isActive,
            requireApproval,
            notificationSettings,
        });

        res.status(201).json({ success: true, id });
    } catch (error) {
        logger.error('Error creating agent', { error, userId });
        const details = (error as Error).message;
        if (details === 'Invalid request: missing required fields') {
            res.status(400).json({ error: details });
            return;
        }
        res.status(500).json({ error: 'Failed to create agent', details });
    }
}

// PATCH /channels/:id - Update an existing agent
export async function updateAgent(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const agentId = req.params.id;
    const update = req.body as Partial<AgentUpdate>;

    try {
        const { id } = await updateAgentForUser(userId, agentId, update);
        res.status(200).json({ success: true, id });
    } catch (error) {
        logger.error('Error updating agent', { error, userId, agentId });
        res.status(500).json({ error: 'Failed to update agent', details: (error as Error).message });
    }
}

// DELETE /channels/:id - Delete an agent
export async function deleteAgent(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const agentId = req.params.id;

    try {
        const prisma = db();

        // Check if agent exists and belongs to user
        const existingAgent: AgentWithInputRelations | null = await prisma.automations.findFirst({
            where: {
                id: agentId,
                user_id: userId
            },
            include: {
                inputs: {
                    include: getInputConfigInclude()
                },
            }
        });

        if (!existingAgent) {
            res.status(404).json({ error: 'Agent not found' });
            return;
        }

        // Tear down agent inputs (e.g., delete webhooks for Figma)
        await tearDownAgentInputs(existingAgent);

        // Delete agent (cascade will delete related records)
        await prisma.automations.delete({
            where: { id: agentId }
        });

        // Invalidate recent agents cache
        emitCacheInvalidationWithKey(userId, 'recentAgents');

        res.status(200).json({ success: true, message: 'Agent deleted successfully' });
    } catch (error) {
        logger.error('Error deleting agent', { error, userId, agentId });
        res.status(500).json({ error: 'Failed to delete agent', details: (error as Error).message });
    }
}

// Helper function to transform AgentWithRelations to frontend Agent format
function transformAgentToFrontendFormat(agent: AgentWithRelations & Partial<AgentWithNotificationSettingsRelations>): Agent {
    if (!agent.outputs || agent.outputs.length === 0) {
        throw new Error(`Agent outputs not found for agent ${agent.id}`);
    }

    return {
        id: agent.id,
        name: agent.name,
        isActive: agent.is_active,
        requireApproval: agent.require_approval ?? false,
        prompt: agent.prompt ? { text: agent.prompt.content } : { text: '' },
        inputs: agent.inputs.map(input => ({
            id: input.id,
            config: convertPrismaConfigToConfigInstance(input)
        })),
        outputs: agent.outputs.map(output => ({
            id: output.id,
            config: convertPrismaOutputConfigToConfigInstance(output),
        })),
        knowledgeBases: (agent as any).knowledge_bases && (agent as any).knowledge_bases.length > 0 ? (agent as any).knowledge_bases.map((kb: any) => ({
            id: kb.id,
            config: convertPrismaKnowledgeBaseConfigToConfigInstance(kb),
        })) : undefined,
        notificationSettings: agent.notification_settings ? {
            enabled: agent.notification_settings.enabled,
            actionTypes: agent.notification_settings.action_types,
        } : undefined,
        updatedAt: agent.updated_at.toISOString(),
    };
}

async function setupAgentInputs(agent: AgentWithInputRelations): Promise<void> {
    for (const input of agent.inputs) {
        try {
            // Convert prisma config to shared config instance to get integration type
            const configInstance = convertPrismaConfigToConfigInstance(input);
            const integrationType = configInstance.integrationType;

            // Find the integration from the registry
            const integration = INTEGRATION_REGISTRY.find(
                (int) => int.integrationType === integrationType
            );

            if (integration) {
                await integration.setupAgentInput(input.integration_id, input);
                logger.info(
                    `✅ Setup completed for ${input.config_type} trigger (ID: ${input.id})`,
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
                `❌ Error setting up ${input.config_type} trigger (ID: ${input.id})`,
                { error, configType: input.config_type, inputId: input.id }
            );
        }
    }
}

/**
 * Tears down setup for all triggers in an agent by calling teardownAgentInput on each integration.
 * Called before an agent is deleted.
 */
async function tearDownAgentInputs(agent: AgentWithInputRelations): Promise<void> {
    for (const input of agent.inputs) {
        try {
            // Convert prisma config to shared config instance to get integration type
            const configInstance = convertPrismaConfigToConfigInstance(input);
            const integrationType = configInstance.integrationType;

            // Find the integration from the registry
            const integration = INTEGRATION_REGISTRY.find(
                (int) => int.integrationType === integrationType
            );

            if (integration) {
                await integration.teardownAgentInput(input.integration_id, input);
                logger.info(
                    `✅ Teardown completed for ${input.config_type} trigger`,
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