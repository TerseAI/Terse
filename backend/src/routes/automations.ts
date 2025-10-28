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

export async function getUserAutomation(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;

    try {
        const automation = await db().automations.findFirst({
            where: { user_id: userId },
            include: {
                prompt: true,
                inputs: true,
                output: true
            }
        });

        if (!automation) {
            res.status(200).json(null);
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
}

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
