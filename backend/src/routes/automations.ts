import { Request, Response } from "express";
import { db } from "../prismaClient";
import { Automation, AutomationInput, AutomationOutput, AutomationPrompt } from "../shared/types";
import { IntegrationType } from "@prisma/client";

// Map frontend integration string to backend IntegrationType enum
const integrationTypeMap: Record<string, IntegrationType> = {
    'github': IntegrationType.GITHUB,
    'gmail': IntegrationType.GMAIL,
    'linear': IntegrationType.LINEAR,
    'jira': IntegrationType.JIRA,
    'slack': IntegrationType.SLACK,
    'notion': IntegrationType.NOTION,
};

// Helper function to validate that user owns an integration
async function validateUserOwnsIntegration(userId: string, integrationType: IntegrationType, integrationId: string): Promise<boolean> {
    const prisma = db();

    switch (integrationType) {
        case IntegrationType.GITHUB:
            const userGithubRepo = await prisma.user_github_repositories.findFirst({
                where: {
                    user_id: userId,
                    github_repository_id: integrationId
                }
            });
            return !!userGithubRepo;

        case IntegrationType.LINEAR:
            const linearKey = await prisma.linear_api_keys.findFirst({
                where: {
                    id: integrationId,
                    user_id: userId
                }
            });
            return !!linearKey;

        case IntegrationType.JIRA:
            const jiraKey = await prisma.jira_api_keys.findFirst({
                where: {
                    id: integrationId,
                    user_id: userId
                }
            });
            return !!jiraKey;

        case IntegrationType.SLACK:
            const userSlackIntegration = await prisma.user_slack_integrations.findFirst({
                where: {
                    id: integrationId,
                    user_id: userId
                }
            });
            return !!userSlackIntegration;

        case IntegrationType.GMAIL:
            const gmailIntegration = await prisma.gmail_integrations.findFirst({
                where: {
                    id: integrationId,
                    user_id: userId
                }
            });
            return !!gmailIntegration;

        case IntegrationType.NOTION:
            const notionIntegration = await prisma.notion_integrations.findFirst({
                where: {
                    id: integrationId,
                    user_id: userId
                }
            });
            return !!notionIntegration;

        default:
            return false;
    }
}

// GET /automations - List all automations with pagination
export async function getUserAutomations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;

    // Parse pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

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
        const automations = await prisma.automations.findMany({
            where,
            include: {
                prompt: true,
                inputs: true,
                output: true
            },
            orderBy: { created_at: 'desc' },
            skip,
            take: limit
        });

        // Transform the data to match frontend format
        const response = {
            automations: automations.map(automation => ({
                id: automation.id,
                name: automation.name,
                isActive: automation.is_active,
                prompt: automation.prompt ? { text: automation.prompt.content } : undefined,
                inputs: automation.inputs.map(input => ({
                    integration: input.integration_type.toLowerCase()
                })),
                output: automation.output ? {
                    integration: automation.output.integration_type.toLowerCase()
                } : undefined
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching automations:', error);
        res.status(500).json({ error: 'Failed to fetch automations' });
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
        const automation = await db().automations.findFirst({
            where: {
                id: automationId,
                user_id: userId
            },
            include: {
                prompt: true,
                inputs: true,
                output: true
            }
        });

        if (!automation) {
            res.status(404).json({ error: 'Automation not found' });
            return;
        }

        // Transform the data to match frontend format
        const response: Automation = {
            id: automation.id,
            name: automation.name,
            isActive: automation.is_active,
            prompt: automation.prompt ? { text: automation.prompt.content } : undefined,
            inputs: automation.inputs.map(input => ({
                integration: input.integration_type.toLowerCase(),
                integrationId: input.integration_id
            })),
            output: automation.output ? {
                integration: automation.output.integration_type.toLowerCase(),
                integrationId: automation.output.integration_id
            } : undefined
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching automation:', error);
        res.status(500).json({ error: 'Failed to fetch automation' });
    }
}

interface SaveAutomationRequest {
    name: string;
    inputs: AutomationInput[];
    output: AutomationOutput;
    prompt: AutomationPrompt;
    isActive?: boolean;
}

// POST /automations - Create a new automation
export async function createAutomation(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const { name, inputs, output, prompt, isActive = true } = req.body as SaveAutomationRequest;

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
                const integrationType = integrationTypeMap[input.integration];
                if (!integrationType) {
                    throw new Error(`Unknown integration type: ${input.integration}`);
                }

                const integrationId = await getIntegrationId(userId, integrationType);
                if (!integrationId) {
                    throw new Error(`Integration ${input.integration} not found for user`);
                }

                await tx.automation_inputs.create({
                    data: {
                        automation_id: newAutomation.id,
                        integration_type: integrationType,
                        integration_id: integrationId
                    }
                });
            }

            // Create output
            const outputIntegrationType = integrationTypeMap[output.integration];
            if (!outputIntegrationType) {
                throw new Error(`Unknown integration type: ${output.integration}`);
            }

            const outputIntegrationId = await getIntegrationId(userId, outputIntegrationType);
            if (!outputIntegrationId) {
                throw new Error(`Integration ${output.integration} not found for user`);
            }

            await tx.automation_outputs.create({
                data: {
                    automation_id: newAutomation.id,
                    integration_type: outputIntegrationType,
                    integration_id: outputIntegrationId
                }
            });

            return newAutomation;
        });

        res.status(201).json({ success: true, id: automation.id });
    } catch (error) {
        console.error('Error creating automation:', error);
        res.status(500).json({ error: 'Failed to create automation', details: (error as Error).message });
    }
}

// Legacy endpoint - kept for backward compatibility
export async function saveAutomation(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const { name, inputs, output, prompt } = req.body as SaveAutomationRequest;

    // Validate request
    if (!name || !inputs || inputs.length === 0 || !output || !prompt?.text) {
        res.status(400).json({ error: 'Invalid request: missing required fields' });
        return;
    }

    try {
        const prisma = db();

        // Check if user already has an automation
        const existingAutomation = await prisma.automations.findFirst({
            where: { user_id: userId }
        });

        if (existingAutomation) {
            // Update existing automation
            await prisma.$transaction(async (tx) => {
                // Delete old inputs and output
                await tx.automation_inputs.deleteMany({
                    where: { automation_id: existingAutomation.id }
                });

                const existingOutput = await tx.automation_outputs.findUnique({
                    where: { automation_id: existingAutomation.id }
                });
                if (existingOutput) {
                    await tx.automation_outputs.delete({
                        where: { automation_id: existingAutomation.id }
                    });
                }

                // Update automation name
                await tx.automations.update({
                    where: { id: existingAutomation.id },
                    data: { name }
                });

                // Update or create prompt
                await tx.automation_prompts.upsert({
                    where: { automation_id: existingAutomation.id },
                    update: { content: prompt.text },
                    create: {
                        automation_id: existingAutomation.id,
                        content: prompt.text
                    }
                });

                // Create new inputs
                for (const input of inputs) {
                    const integrationType = integrationTypeMap[input.integration];
                    if (!integrationType) {
                        throw new Error(`Unknown integration type: ${input.integration}`);
                    }

                    // Validate that user owns the integration
                    const integrationId = (input as any).integrationId;
                    if (!integrationId) {
                        throw new Error(`Integration ID is required for ${input.integration}`);
                    }

                    const isOwner = await validateUserOwnsIntegration(userId, integrationType, integrationId);
                    if (!isOwner) {
                        throw new Error(`Integration ${input.integration} not found or not owned by user`);
                    }

                    await tx.automation_inputs.create({
                        data: {
                            automation_id: existingAutomation.id,
                            integration_type: integrationType,
                            integration_id: integrationId
                        }
                    });
                }

                // Create new output
                const outputIntegrationType = integrationTypeMap[output.integration];
                if (!outputIntegrationType) {
                    throw new Error(`Unknown integration type: ${output.integration}`);
                }

                const outputIntegrationId = (output as any).integrationId;
                if (!outputIntegrationId) {
                    throw new Error(`Integration ID is required for ${output.integration}`);
                }

                const isOwner = await validateUserOwnsIntegration(userId, outputIntegrationType, outputIntegrationId);
                if (!isOwner) {
                    throw new Error(`Integration ${output.integration} not found or not owned by user`);
                }

                await tx.automation_outputs.create({
                    data: {
                        automation_id: existingAutomation.id,
                        integration_type: outputIntegrationType,
                        integration_id: outputIntegrationId
                    }
                });
            });

            res.status(200).json({ success: true, id: existingAutomation.id });
        } else {
            // Create new automation
            const automation = await prisma.$transaction(async (tx) => {
                // Create automation
                const newAutomation = await tx.automations.create({
                    data: {
                        user_id: userId,
                        name,
                        is_active: true
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
                    const integrationType = integrationTypeMap[input.integration];
                    if (!integrationType) {
                        throw new Error(`Unknown integration type: ${input.integration}`);
                    }

                    // Validate that user owns the integration
                    const integrationId = (input as any).integrationId;
                    if (!integrationId) {
                        throw new Error(`Integration ID is required for ${input.integration}`);
                    }

                    const isOwner = await validateUserOwnsIntegration(userId, integrationType, integrationId);
                    if (!isOwner) {
                        throw new Error(`Integration ${input.integration} not found or not owned by user`);
                    }

                    await tx.automation_inputs.create({
                        data: {
                            automation_id: newAutomation.id,
                            integration_type: integrationType,
                            integration_id: integrationId
                        }
                    });
                }

                // Create output
                const outputIntegrationType = integrationTypeMap[output.integration];
                if (!outputIntegrationType) {
                    throw new Error(`Unknown integration type: ${output.integration}`);
                }

                const outputIntegrationId = (output as any).integrationId;
                if (!outputIntegrationId) {
                    throw new Error(`Integration ID is required for ${output.integration}`);
                }

                const isOwner = await validateUserOwnsIntegration(userId, outputIntegrationType, outputIntegrationId);
                if (!isOwner) {
                    throw new Error(`Integration ${output.integration} not found or not owned by user`);
                }

                await tx.automation_outputs.create({
                    data: {
                        automation_id: newAutomation.id,
                        integration_type: outputIntegrationType,
                        integration_id: outputIntegrationId
                    }
                });

                return newAutomation;
            });

            res.status(201).json({ success: true, id: automation.id });
        }
    } catch (error) {
        console.error('Error saving automation:', error);
        res.status(500).json({ error: 'Failed to save automation', details: (error as Error).message });
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
    const { name, inputs, output, prompt, isActive } = req.body as Partial<SaveAutomationRequest>;

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
                // Delete old inputs
                await tx.automation_inputs.deleteMany({
                    where: { automation_id: automationId }
                });

                // Create new inputs
                for (const input of inputs) {
                    const integrationType = integrationTypeMap[input.integration];
                    if (!integrationType) {
                        throw new Error(`Unknown integration type: ${input.integration}`);
                    }

                    const integrationId = await getIntegrationId(userId, integrationType);
                    if (!integrationId) {
                        throw new Error(`Integration ${input.integration} not found for user`);
                    }

                    await tx.automation_inputs.create({
                        data: {
                            automation_id: automationId,
                            integration_type: integrationType,
                            integration_id: integrationId
                        }
                    });
                }
            }

            // Update output if provided
            if (output) {
                const outputIntegrationType = integrationTypeMap[output.integration];
                if (!outputIntegrationType) {
                    throw new Error(`Unknown integration type: ${output.integration}`);
                }

                const outputIntegrationId = await getIntegrationId(userId, outputIntegrationType);
                if (!outputIntegrationId) {
                    throw new Error(`Integration ${output.integration} not found for user`);
                }

                // Delete old output
                const existingOutput = await tx.automation_outputs.findUnique({
                    where: { automation_id: automationId }
                });
                if (existingOutput) {
                    await tx.automation_outputs.delete({
                        where: { automation_id: automationId }
                    });
                }

                // Create new output
                await tx.automation_outputs.create({
                    data: {
                        automation_id: automationId,
                        integration_type: outputIntegrationType,
                        integration_id: outputIntegrationId
                    }
                });
            }
        });

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

        // Delete automation (cascade will delete related records)
        await prisma.automations.delete({
            where: { id: automationId }
        });

        res.status(200).json({ success: true, message: 'Automation deleted successfully' });
    } catch (error) {
        console.error('Error deleting automation:', error);
        res.status(500).json({ error: 'Failed to delete automation', details: (error as Error).message });
    }
}
