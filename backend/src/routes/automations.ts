import { Request, Response } from "express";
import { db } from "../prismaClient";
import { Automation, AutomationInput, AutomationOutput, AutomationPrompt } from "../shared/types";
import { IntegrationType } from "@prisma/client";
import { parsePageParams } from "../utility/pagination";
import chalk from "chalk";
import { AutomationInputSetup } from "../setup/AutomationInputSetup";

// Map frontend integration string to backend IntegrationType enum
const integrationTypeMap: Record<string, IntegrationType> = {
    'github': IntegrationType.GITHUB,
    'gmail': IntegrationType.GMAIL,
    'linear': IntegrationType.LINEAR,
    'jira': IntegrationType.JIRA,
    'confluence': IntegrationType.CONFLUENCE,
    'slack': IntegrationType.SLACK,
    'notion': IntegrationType.NOTION,
    'notion_page': IntegrationType.NOTION_PAGE,
    'figma': IntegrationType.FIGMA,
};

// Helper function to create config record for an automation input
async function createInputConfig(
    tx: any,
    inputId: string,
    integrationType: IntegrationType,
    config: AutomationInput
): Promise<void> {
    switch (integrationType) {
        case IntegrationType.SLACK:
            if (config.slackConfig) {
                await tx.automation_slack_configs.create({
                    data: {
                        automation_input_id: inputId,
                        channel_id: config.slackConfig.channelId || null,
                        channel_name: config.slackConfig.channelName || null,
                        listen_to_user_dms: config.slackConfig.listenToUserDms || false,
                    },
                });
            }
            break;
        case IntegrationType.NOTION:
            if (config.notionConfig) {
                await tx.automation_notion_configs.create({
                    data: {
                        automation_input_id: inputId,
                        database_id: config.notionConfig.databaseId || null,
                        database_name: config.notionConfig.databaseName || null,
                    },
                });
            }
            break;
        case IntegrationType.LINEAR:
            if (config.linearConfig) {
                await tx.automation_linear_configs.create({
                    data: {
                        automation_input_id: inputId,
                        project_id: config.linearConfig.projectId || null,
                        project_name: config.linearConfig.projectName || null,
                    },
                });
            }
            break;
        case IntegrationType.JIRA:
            if (config.jiraConfig) {
                await tx.automation_jira_configs.create({
                    data: {
                        automation_input_id: inputId,
                        project_key: config.jiraConfig.projectKey || null,
                        project_id: config.jiraConfig.projectId || null,
                    },
                });
            }
            break;
        case IntegrationType.CONFLUENCE:
            if (config.confluenceConfig) {
                await tx.automation_confluence_configs.create({
                    data: {
                        automation_input_id: inputId,
                        space_id: config.confluenceConfig.spaceId || null,
                        space_key: config.confluenceConfig.spaceKey || null,
                        page_id: config.confluenceConfig.pageId,
                        page_name: config.confluenceConfig.pageName || null,
                    },
                });
            }
            break;
        case IntegrationType.GITHUB:
            if (config.githubConfig) {
                await tx.automation_github_configs.create({
                    data: {
                        automation_input_id: inputId,
                        repository_id: config.githubConfig.repositoryId || null,
                    },
                });
            }
            break;
        case IntegrationType.GMAIL:
            // Gmail configs are empty for now, but create record for consistency
            await tx.automation_gmail_configs.create({
                data: {
                    automation_input_id: inputId,
                },
            });
            break;
        case IntegrationType.FIGMA:
            // Figma config is required for Figma integrations
            if (!config.figmaConfig) {
                throw new Error('figmaConfig is required for Figma integration');
            }
            console.log(chalk.blue("Figma config received:"), chalk.yellow(JSON.stringify(config.figmaConfig, null, 2)));
            // Validate that fileKey is provided for Figma configs
            if (!config.figmaConfig.fileKey || config.figmaConfig.fileKey.trim() === '') {
                throw new Error('fileKey is required for Figma integration');
            }
            await tx.automation_figma_configs.create({
                data: {
                    automation_input: {
                        connect: { id: inputId }
                    },
                    file_key: config.figmaConfig.fileKey,
                    file_name: config.figmaConfig.fileName || null,
                    team_id: config.figmaConfig.teamId || null,
                },
            });
            break;
    }
}

// Helper function to create config record for an automation output
async function createOutputConfig(
    tx: any,
    outputId: string,
    integrationType: IntegrationType,
    config: AutomationOutput
): Promise<void> {
    switch (integrationType) {
        case IntegrationType.SLACK:
            if (config.slackConfig) {
                await tx.automation_slack_configs.create({
                    data: {
                        automation_output_id: outputId,
                        channel_id: config.slackConfig.channelId || null,
                        channel_name: config.slackConfig.channelName || null,
                    },
                });
            }
            break;
        case IntegrationType.NOTION:
            if (config.notionConfig) {
                await tx.automation_notion_configs.create({
                    data: {
                        automation_output_id: outputId,
                        database_id: config.notionConfig.databaseId || null,
                        database_name: config.notionConfig.databaseName || null,
                    },
                });
            }
            break;
        case IntegrationType.NOTION_PAGE:
            if (config.notionPageConfig) {
                await tx.automation_notion_page_configs.create({
                    data: {
                        automation_output_id: outputId,
                        page_id: config.notionPageConfig.pageId || null,
                        page_name: config.notionPageConfig.pageName || null,
                    },
                });
            }
            break;
        case IntegrationType.LINEAR:
            if (config.linearConfig) {
                await tx.automation_linear_configs.create({
                    data: {
                        automation_output_id: outputId,
                        project_id: config.linearConfig.projectId || null,
                        project_name: config.linearConfig.projectName || null,
                    },
                });
            }
            break;
        case IntegrationType.JIRA:
            if (config.jiraConfig) {
                await tx.automation_jira_configs.create({
                    data: {
                        automation_output_id: outputId,
                        project_key: config.jiraConfig.projectKey || null,
                        project_id: config.jiraConfig.projectId || null,
                    },
                });
            }
            break;
        case IntegrationType.CONFLUENCE:
            if (config.confluenceConfig) {
                await tx.automation_confluence_configs.create({
                    data: {
                        automation_output_id: outputId,
                        space_id: config.confluenceConfig.spaceId || null,
                        space_key: config.confluenceConfig.spaceKey || null,
                        page_id: config.confluenceConfig.pageId,
                        page_name: config.confluenceConfig.pageName || null,
                    },
                });
            }
            break;
        case IntegrationType.GITHUB:
            if (config.githubConfig) {
                await tx.automation_github_configs.create({
                    data: {
                        automation_output_id: outputId,
                        repository_id: config.githubConfig.repositoryId || null,
                    },
                });
            }
            break;
        case IntegrationType.GMAIL:
            // Gmail configs are empty for now, but create record for consistency
            await tx.automation_gmail_configs.create({
                data: {
                    automation_output_id: outputId,
                },
            });
            break;
        case IntegrationType.FIGMA:
            if (config.figmaConfig) {
                await tx.automation_figma_configs.create({
                    data: {
                        automation_output: {
                            connect: { id: outputId }
                        },
                        file_key: config.figmaConfig.fileKey || null,
                        file_name: config.figmaConfig.fileName || null,
                        team_id: config.figmaConfig.teamId || null,
                    },
                });
            }
            break;
    }
}

// Helper function to transform config from database to API format
function transformInputConfig(input: any): AutomationInput {
    const base: AutomationInput = {
        integration: input.integration_type.toLowerCase(),
        integrationId: input.integration_id,
    };

    if (input.slack_config) {
        base.slackConfig = {
            channelId: input.slack_config.channel_id || undefined,
            channelName: input.slack_config.channel_name || undefined,
            listenToUserDms: input.slack_config.listen_to_user_dms || false,
        };
    }
    if (input.notion_config) {
        base.notionConfig = {
            databaseId: input.notion_config.database_id || undefined,
            databaseName: input.notion_config.database_name || undefined,
        };
    }
    if (input.linear_config) {
        base.linearConfig = {
            projectId: input.linear_config.project_id || undefined,
            projectName: input.linear_config.project_name || undefined,
        };
    }
    if (input.jira_config) {
        base.jiraConfig = {
            projectKey: input.jira_config.project_key || undefined,
            projectId: input.jira_config.project_id || undefined,
        };
    }
    if (input.confluence_config) {
        base.confluenceConfig = {
            spaceId: input.confluence_config.space_id || undefined,
            spaceKey: input.confluence_config.space_key || undefined,
            pageId: input.confluence_config.page_id,
            pageName: input.confluence_config.page_name || undefined,
        };
    }
    if (input.github_config) {
        base.githubConfig = {
            repositoryId: input.github_config.repository_id || undefined,
        };
    }
    if (input.gmail_config) {
        base.gmailConfig = {};
    }
    if (input.figma_config) {
        base.figmaConfig = {
            fileKey: input.figma_config.file_key || undefined,
            fileName: input.figma_config.file_name || undefined,
            teamId: input.figma_config.team_id || undefined,
        };
    }

    return base;
}

// Helper function to transform output config from database to API format
// TODO: I feel like this shouldn't exist?
function transformOutputConfig(output: any): AutomationOutput {
    const base: AutomationOutput = {
        integration: output.integration_type.toLowerCase(),
        integrationId: output.integration_id,
    };

    if (output.slack_config) {
        base.slackConfig = {
            channelId: output.slack_config.channel_id || undefined,
            channelName: output.slack_config.channel_name || undefined,
        };
    }
    if (output.notion_config) {
        base.notionConfig = {
            databaseId: output.notion_config.database_id || undefined,
            databaseName: output.notion_config.database_name || undefined,
        };
    }
    if (output.notion_page_config) {
        base.notionPageConfig = {
            pageId: output.notion_page_config.page_id || undefined,
            pageName: output.notion_page_config.page_name || undefined,
        };
    }
    if (output.linear_config) {
        base.linearConfig = {
            projectId: output.linear_config.project_id || undefined,
            projectName: output.linear_config.project_name || undefined,
        };
    }
    if (output.jira_config) {
        base.jiraConfig = {
            projectKey: output.jira_config.project_key || undefined,
            projectId: output.jira_config.project_id || undefined,
        };
    }
    if (output.notion_page_config) {
        base.notionPageConfig = {
            pageId: output.notion_page_config.page_id || undefined,
            pageName: output.notion_page_config.page_name || undefined,
        };
    }
    if (output.confluence_config) {
        base.confluenceConfig = {
            spaceId: output.confluence_config.space_id || undefined,
            spaceKey: output.confluence_config.space_key || undefined,
            pageId: output.confluence_config.page_id,
            pageName: output.confluence_config.page_name || undefined,
        };
    }
    if (output.github_config) {
        base.githubConfig = {
            repositoryId: output.github_config.repository_id || undefined,
        };
    }
    if (output.gmail_config) {
        base.gmailConfig = {};
    }
    if (output.figma_config) {
        base.figmaConfig = {
            fileKey: output.figma_config.file_key || undefined,
            fileName: output.figma_config.file_name || undefined,
            teamId: output.figma_config.team_id || undefined,
        };
    }

    return base;
}

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

        case IntegrationType.CONFLUENCE:
            // Confluence uses the same credentials as Jira
            const confluenceJiraKey = await prisma.jira_api_keys.findFirst({
                where: {
                    id: integrationId,
                    user_id: userId
                }
            });
            return !!confluenceJiraKey;

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

        case IntegrationType.NOTION_PAGE:
            const notionPageIntegration = await prisma.notion_integrations.findFirst({
                where: {
                    id: integrationId,
                    user_id: userId
                }
            });
            return !!notionPageIntegration;

        case IntegrationType.FIGMA:
            const figmaIntegration = await prisma.figma_integrations.findFirst({
                where: {
                    id: integrationId,
                    user_id: userId
                }
            });
            return !!figmaIntegration;

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
        const automations = await prisma.automations.findMany({
            where,
            include: {
                prompt: true,
                inputs: {
                    include: {
                        slack_config: true,
                        notion_config: true,
                        linear_config: true,
                        jira_config: true,
                        confluence_config: true,
                        github_config: true,
                        gmail_config: true,
                        figma_config: true,
                    }
                },
                output: {
                    include: {
                        slack_config: true,
                        notion_config: true,
                        linear_config: true,
                        jira_config: true,
                        confluence_config: true,
                        github_config: true,
                        gmail_config: true,
                        figma_config: true,
                    }
                }
            },
            orderBy: { created_at: 'desc' },
            skip,
            take
        });

        // Transform the data to match frontend format
        const response = {
            automations: automations.map(automation => ({
                id: automation.id,
                name: automation.name,
                isActive: automation.is_active,
                prompt: automation.prompt ? { text: automation.prompt.content } : undefined,
                inputs: automation.inputs.map(input => transformInputConfig(input)),
                output: automation.output ? transformOutputConfig(automation.output) : undefined
            })),
            pagination: {
                page,
                pageSize,
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
                inputs: {
                    include: {
                        slack_config: true,
                        notion_config: true,
                        linear_config: true,
                        jira_config: true,
                        github_config: true,
                        gmail_config: true,
                        figma_config: true,
                    }
                },
                output: {
                    include: {
                        slack_config: true,
                        notion_config: true,
                        notion_page_config: true,
                        linear_config: true,
                        jira_config: true,
                        confluence_config: true,
                        github_config: true,
                        gmail_config: true,
                        figma_config: true,
                    }
                }
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
            inputs: automation.inputs.map(input => transformInputConfig(input)),
            output: automation.output ? transformOutputConfig(automation.output) : undefined
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

                const newInput = await tx.automation_inputs.create({
                    data: {
                        automation_id: newAutomation.id,
                        integration_type: integrationType,
                        integration_id: integrationId
                    }
                });

                // Create config record if provided
                await createInputConfig(tx, newInput.id, integrationType, input);
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

            console.log(chalk.green("Output integration ID:"), chalk.yellow(outputIntegrationId));

            console.log(chalk.green("Output integration type:"), chalk.yellow(outputIntegrationType));

            console.log(chalk.green("Creating new output:"), chalk.yellow(JSON.stringify(output, null, 2)));

            const newOutput = await tx.automation_outputs.create({
                data: {
                    automation_id: newAutomation.id,
                    integration_type: outputIntegrationType,
                    integration_id: outputIntegrationId
                }
            });

            // Create config record if provided
            await createOutputConfig(tx, newOutput.id, outputIntegrationType, output);

            return newAutomation;
        });

        // Set up automation inputs (e.g., create webhooks for Figma)
        await AutomationInputSetup.setupAutomationInputs(automation.id);

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
            // Tear down old inputs before updating
            await AutomationInputSetup.tearDownAutomationInputs(existingAutomation.id);

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

                    const newInput = await tx.automation_inputs.create({
                        data: {
                            automation_id: existingAutomation.id,
                            integration_type: integrationType,
                            integration_id: integrationId
                        }
                    });

                    // Create config record if provided
                    await createInputConfig(tx, newInput.id, integrationType, input);
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

                const newOutput = await tx.automation_outputs.create({
                    data: {
                        automation_id: existingAutomation.id,
                        integration_type: outputIntegrationType,
                        integration_id: outputIntegrationId
                    }
                });

                // Create config record if provided
                await createOutputConfig(tx, newOutput.id, outputIntegrationType, output);
            });

            // Set up new automation inputs after update
            await AutomationInputSetup.setupAutomationInputs(existingAutomation.id);

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

                    const newInput = await tx.automation_inputs.create({
                        data: {
                            automation_id: newAutomation.id,
                            integration_type: integrationType,
                            integration_id: integrationId
                        }
                    });

                    // Create config record if provided
                    await createInputConfig(tx, newInput.id, integrationType, input);
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

                const newOutput = await tx.automation_outputs.create({
                    data: {
                        automation_id: newAutomation.id,
                        integration_type: outputIntegrationType,
                        integration_id: outputIntegrationId
                    }
                });

                // Create config record if provided
                await createOutputConfig(tx, newOutput.id, outputIntegrationType, output);

                return newAutomation;
            });

            // Set up automation inputs (e.g., create webhooks for Figma)
            await AutomationInputSetup.setupAutomationInputs(automation.id);

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
                // Delete old inputs (configs cascade delete)
                await tx.automation_inputs.deleteMany({
                    where: { automation_id: automationId }
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

                    const newInput = await tx.automation_inputs.create({
                        data: {
                            automation_id: automationId,
                            integration_type: integrationType,
                            integration_id: integrationId
                        }
                    });

                    // Create config record if provided
                    await createInputConfig(tx, newInput.id, integrationType, input);
                }
            }

            // Update output if provided
            if (output) {
                const outputIntegrationType = integrationTypeMap[output.integration];
                if (!outputIntegrationType) {
                    throw new Error(`Unknown integration type: ${output.integration}`);
                }

                const outputIntegrationId = output.integrationId;
                if (!outputIntegrationId) {
                    throw new Error(`Integration ID is required for ${output.integration}`);
                }

                const isOwner = await validateUserOwnsIntegration(userId, outputIntegrationType, outputIntegrationId);
                if (!isOwner) {
                    throw new Error(`Integration ${output.integration} not found or not owned by user`);
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
                        integration_type: outputIntegrationType,
                        integration_id: outputIntegrationId
                    }
                });

                // Create config record if provided
                await createOutputConfig(tx, newOutput.id, outputIntegrationType, output);
            }
        });

        // Set up automation inputs (e.g., create webhooks for Figma)
        await AutomationInputSetup.setupAutomationInputs(automationId);

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
            },
        });

        if (!existingAutomation) {
            res.status(404).json({ error: 'Automation not found' });
            return;
        }

        // Tear down automation inputs (e.g., delete webhooks for Figma)
        await AutomationInputSetup.tearDownAutomationInputs(automationId);

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
