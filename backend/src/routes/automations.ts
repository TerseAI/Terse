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

// Helper function to get integration_id based on integration type
async function getIntegrationId(userId: string, integrationType: IntegrationType): Promise<string | null> {
    const prisma = db();

    switch (integrationType) {
        case IntegrationType.GITHUB:
            const userGithubRepo = await prisma.user_github_repositories.findFirst({
                where: { user_id: userId }
            });
            return userGithubRepo?.github_repository_id || null;

        case IntegrationType.LINEAR:
            const linearKey = await prisma.linear_api_keys.findUnique({
                where: { user_id: userId }
            });
            return linearKey?.id || null;

        case IntegrationType.JIRA:
            const jiraKey = await prisma.jira_api_keys.findUnique({
                where: { user_id: userId }
            });
            return jiraKey?.id || null;

        case IntegrationType.SLACK:
            const userSlackIntegration = await prisma.user_slack_integrations.findFirst({
                where: { user_id: userId }
            });
            return userSlackIntegration?.id || null;

        case IntegrationType.GMAIL:
            const gmailIntegration = await prisma.gmail_integrations.findFirst({
                where: { user_id: userId, is_active: true }
            });
            return gmailIntegration?.id || null;

        case IntegrationType.NOTION:
            // TODO: Implement when Notion integration is added
            return null;

        default:
            return null;
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
                integration: input.integration_type.toLowerCase()
            })),
            output: automation.output ? {
                integration: automation.output.integration_type.toLowerCase()
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

                    const integrationId = await getIntegrationId(userId, integrationType);
                    if (!integrationId) {
                        throw new Error(`Integration ${input.integration} not found for user`);
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

                const outputIntegrationId = await getIntegrationId(userId, outputIntegrationType);
                if (!outputIntegrationId) {
                    throw new Error(`Integration ${output.integration} not found for user`);
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
        }
    } catch (error) {
        console.error('Error saving automation:', error);
        res.status(500).json({ error: 'Failed to save automation', details: (error as Error).message });
    }
}
