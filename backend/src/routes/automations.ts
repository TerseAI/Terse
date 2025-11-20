import { Request, Response } from "express";
import { db } from "../prismaClient";
import { Automation, AutomationInput, AutomationsResponse, AutomationUpdate } from "../shared/types";
import { parsePageParams } from "../utility/pagination";
import chalk from "chalk";
import { AutomationWithInputRelations, PrismaTransaction, AutomationWithRelations } from "../types/prisma";
import { IntegrationType } from "../shared/Integrations";
import { convertConfigTypeToInputConfigType, convertConfigTypeToOutputConfigType, convertPrismaConfigToConfigInstance } from "../utility/typeConverters";
import { ConfigInstance } from "../shared/Configs";
import { getInputConfigInclude, getOutputConfigInclude } from "../utility/prismaIncludes";
import { INPUT_REGISTRY } from "../inputs/InputRegistry";
import { INTEGRATION_REGISTRY } from "../integrations/abstract/IntegrationRegistry";
import { OutputFactory } from "../outputs/abstract/OutputFactory";
import { emitCacheInvalidationWithKey } from "../realtimeSocket";

async function createInputConfig(
    tx: PrismaTransaction,
    inputId: string,
    config: AutomationInput
): Promise<void> {
    console.log(chalk.cyan('🔵 [INPUT CONFIG] config:', JSON.stringify(config, null, 2)));
    const input = INPUT_REGISTRY.find(input => input.configType === config.config.configType);
    if (!input) {
        throw new Error(`Input not found for integration type: ${config.config.configType}`);
    }
    await input.addInputToAutomation(tx, inputId, config.config);
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
    await output().addOutputToAutomation(tx, outputId, config);
}

async function validateUserOwnsIntegration(userId: string, integrationType: IntegrationType, integrationId: string): Promise<boolean> {
    const integration = INTEGRATION_REGISTRY.find(integration => integration.integrationType === integrationType);
    if (!integration) {
        throw new Error(`Integration ${integrationType} not found`);
    }
    const instances = await integration.getInstancesForUser(userId);
    return instances.some(instance => instance.id === integrationId);
}

// GET /automations - List all automations with pagination
export async function getUserAutomations(req: Request, res: Response) {
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
        const automations: AutomationWithRelations[] = await prisma.automations.findMany({
            where,
            include: {
                prompt: true,
                inputs: {
                    include: getInputConfigInclude()
                },
                output: {
                    include: getOutputConfigInclude()
                }
            },
            orderBy: { created_at: 'desc' },
            skip,
            take
        });

        if (!automations.some(automation => automation.output)) {
            throw new Error(`Automation output not found`);
        }

        // Transform the data to match frontend format
        const response: AutomationsResponse = {
            automations: automations.map(automation => transformAutomationToFrontendFormat(automation)),
            pagination: {
                page,
                limit: pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
            }
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching automations:', error);
        res.status(500).json({ error: 'Failed to fetch automations' });
    }
}

// GET /automations/recent - Get recently modified automations with last event processed time
export async function getRecentAutomations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const limit = parseInt(req.query.limit as string) || 3;

    try {
        const prisma = db();

        // Get recently modified automations ordered by updated_at
        const automations: (AutomationWithRelations & { run_history_records: { timestamp: Date }[] })[] = await prisma.automations.findMany({
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
                run_history_records: {
                    orderBy: { timestamp: 'desc' },
                    take: 1,
                    select: {
                        timestamp: true
                    }
                }
            },
            orderBy: { updated_at: 'desc' },
            take: limit
        });

        // Get the last event processed time for each automation
        const lastEventMap = new Map<string, Date>();

        for (const automation of automations) {
            // run_history_records is an array (even with take: 1), so get the first element
            const lastEvent = automation.run_history_records[0];
            if (lastEvent) {
                lastEventMap.set(automation.id, lastEvent.timestamp);
            }
        }
        // Transform the data to match frontend format with timestamps
        const response = automations.map(automation => {
            const lastEventTimestamp = lastEventMap.get(automation.id);
            return {
                ...transformAutomationToFrontendFormat(automation),
                updatedAt: automation.updated_at.toISOString(),
                lastEventProcessedAt: lastEventTimestamp ? lastEventTimestamp.toISOString() : null,
            };
        });

        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching recent automations:', error);
        res.status(500).json({ error: 'Failed to fetch recent automations' });
    }
}

// GET /automations/:id - Get single automation by ID
export async function getUserAutomation(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const automationId = req.params.id;

    try {
        const automation: AutomationWithRelations | null = await db().automations.findFirst({
            where: {
                id: automationId,
                user_id: userId
            },
            include: {
                prompt: true,
                inputs: {
                    include: getInputConfigInclude()
                },
                output: {
                    include: getOutputConfigInclude()
                }
            }
        });

        if (!automation || !automation.output) {
            res.status(404).json({ error: 'Automation not found' });
            return;
        }

        // Transform the data to match frontend format
        const response: Automation = transformAutomationToFrontendFormat(automation);

        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching automation:', error);
        res.status(500).json({ error: 'Failed to fetch automation' });
    }
}

// POST /automations - Create a new automation
export async function createAutomation(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const { name, inputs, output, prompt, isActive = true } = req.body as AutomationUpdate;
    console.log(chalk.green("Output from frontend:"), chalk.yellow(JSON.stringify(output, null, 2)));
    console.log(chalk.blue("Inputs from frontend:"), chalk.yellow(JSON.stringify(inputs, null, 2)));

    // Validate request
    if (!name || !inputs || inputs.length === 0 || !output || !prompt?.text) {
        res.status(400).json({ error: 'Invalid request: missing required fields' });
        return;
    }

    try {
        const prisma = db();

        // Create new automation
        const automation = await prisma.$transaction(async (tx) => {
            // Create automation
            const newAutomation = await tx.automations.create({
                data: {
                    user_id: userId,
                    name,
                    is_active: isActive
                }
            });

            // Create prompt
            await tx.automation_prompts.create({
                data: {
                    automation_id: newAutomation.id,
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
                        automation_id: newAutomation.id,
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
                    automation_id: newAutomation.id,
                    config_type: convertConfigTypeToOutputConfigType(outputConfigType),
                    integration_id: outputIntegrationId
                }
            });

            // Create config record if provided
            await createOutputConfig(tx, newOutput.id, output.config);

            return newAutomation;
        });

        const automationWithRelations: AutomationWithInputRelations | null = await prisma.automations.findFirst({
            where: { id: automation.id },
            include: {
                inputs: {
                    include: getInputConfigInclude()
                },
            }
        });

        if (!automationWithRelations) {
            throw new Error(`Automation not found: ${automation.id}`);
        }

        // Set up automation inputs (e.g., create webhooks for Figma)
        await setupAutomationInputs(automationWithRelations);

        // Invalidate recent automations cache
        emitCacheInvalidationWithKey(userId, 'recentAutomations');

        res.status(201).json({ success: true, id: automation.id });
    } catch (error) {
        console.error('Error creating automation:', error);
        res.status(500).json({ error: 'Failed to create automation', details: (error as Error).message });
    }
}

// PATCH /automations/:id - Update an existing automation
export async function updateAutomation(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const automationId = req.params.id;
    const { name, inputs, output, prompt, isActive } = req.body as Partial<AutomationUpdate>;

    try {
        const prisma = db();

        // Check if automation exists and belongs to user
        const existingAutomation = await prisma.automations.findFirst({
            where: {
                id: automationId,
                user_id: userId
            }
        });

        if (!existingAutomation) {
            res.status(404).json({ error: 'Automation not found' });
            return;
        }

        // Update automation in transaction
        await prisma.$transaction(async (tx) => {
            // Update basic fields if provided
            if (name !== undefined || isActive !== undefined) {
                await tx.automations.update({
                    where: { id: automationId },
                    data: {
                        ...(name !== undefined && { name }),
                        ...(isActive !== undefined && { is_active: isActive })
                    }
                });
            }

            // Update prompt if provided
            if (prompt?.text) {
                await tx.automation_prompts.upsert({
                    where: { automation_id: automationId },
                    update: { content: prompt.text },
                    create: {
                        automation_id: automationId,
                        content: prompt.text
                    }
                });
            }

            // Update inputs if provided
            if (inputs && inputs.length > 0) {
                // Delete old inputs (configs cascade delete)
                await tx.automation_inputs.deleteMany({
                    where: { automation_id: automationId }
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
                            automation_id: automationId,
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
                    where: { automation_id: automationId }
                });
                if (existingOutput) {
                    await tx.automation_outputs.delete({
                        where: { automation_id: automationId }
                    });
                }

                // Create new output
                const newOutput = await tx.automation_outputs.create({
                    data: {
                        automation_id: automationId,
                        config_type: convertConfigTypeToOutputConfigType(outputConfigType),
                        integration_id: outputIntegrationId
                    }
                });

                // Create config record if provided
                await createOutputConfig(tx, newOutput.id, output.config);
            }
        });

        const automationWithInputRelations: AutomationWithInputRelations | null = await prisma.automations.findFirst({
            where: { id: automationId },
            include: {
                inputs: {
                    include: getInputConfigInclude()
                },
            }
        });

        if (!automationWithInputRelations) {
            throw new Error(`Automation not found: ${automationId}`);
        }

        // Set up automation inputs (e.g., create webhooks for Figma)
        await setupAutomationInputs(automationWithInputRelations);

        // Invalidate recent automations cache
        emitCacheInvalidationWithKey(userId, 'recentAutomations');

        res.status(200).json({ success: true, id: automationId });
    } catch (error) {
        console.error('Error updating automation:', error);
        res.status(500).json({ error: 'Failed to update automation', details: (error as Error).message });
    }
}

// DELETE /automations/:id - Delete an automation
export async function deleteAutomation(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const automationId = req.params.id;

    try {
        const prisma = db();

        // Check if automation exists and belongs to user
        const existingAutomation: AutomationWithInputRelations | null = await prisma.automations.findFirst({
            where: {
                id: automationId,
                user_id: userId
            },
            include: {
                inputs: {
                    include: getInputConfigInclude()
                },
            }
        });

        if (!existingAutomation) {
            res.status(404).json({ error: 'Automation not found' });
            return;
        }

        // Tear down automation inputs (e.g., delete webhooks for Figma)
        await tearDownAutomationInputs(existingAutomation);

        // Delete automation (cascade will delete related records)
        await prisma.automations.delete({
            where: { id: automationId }
        });

        // Invalidate recent automations cache
        emitCacheInvalidationWithKey(userId, 'recentAutomations');

        res.status(200).json({ success: true, message: 'Automation deleted successfully' });
    } catch (error) {
        console.error('Error deleting automation:', error);
        res.status(500).json({ error: 'Failed to delete automation', details: (error as Error).message });
    }
}

// Helper function to transform AutomationWithRelations to frontend Automation format
function transformAutomationToFrontendFormat(automation: AutomationWithRelations): Automation {
    if (!automation.output) {
        throw new Error(`Automation output not found for automation ${automation.id}`);
    }

    return {
        id: automation.id,
        name: automation.name,
        isActive: automation.is_active,
        prompt: automation.prompt ? { text: automation.prompt.content } : { text: '' },
        inputs: automation.inputs.map(input => ({
            id: input.id,
            config: convertPrismaConfigToConfigInstance(input)
        })),
        output: {
            id: automation.output.id,
            config: convertPrismaConfigToConfigInstance(automation.output),
        }
    };
}

async function setupAutomationInputs(automation: AutomationWithInputRelations): Promise<void> {
    for (const input of automation.inputs) {
        try {
            // Convert prisma config to shared config instance to get integration type
            const configInstance = convertPrismaConfigToConfigInstance(input);
            const integrationType = configInstance.integrationType;

            // Find the integration from the registry
            const integration = INTEGRATION_REGISTRY.find(
                (int) => int.integrationType === integrationType
            );

            if (integration) {
                await integration.setupAutomationInput(input.integration_id, input);
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
 * Tears down setup for all inputs in an automation by calling teardownAutomationInput on each integration.
 * Called before an automation is deleted.
 */
async function tearDownAutomationInputs(automation: AutomationWithInputRelations): Promise<void> {
    for (const input of automation.inputs) {
        try {
            // Convert prisma config to shared config instance to get integration type
            const configInstance = convertPrismaConfigToConfigInstance(input);
            const integrationType = configInstance.integrationType;

            // Find the integration from the registry
            const integration = INTEGRATION_REGISTRY.find(
                (int) => int.integrationType === integrationType
            );

            if (integration) {
                await integration.teardownAutomationInput(input.integration_id, input);
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