import { Request, Response } from "express";
import { db } from "../prismaClient";
import { Automation, AutomationInput, AutomationOutput, AutomationPrompt, AutomationVersion, AutomationVersionsResponse } from "../shared/types";
import { IntegrationType, AutomationStatus, Prisma } from "@prisma/client";
import { parsePageParams } from "../utility/pagination";
import chalk from "chalk";
import { AutomationInputSetup } from "../setup/AutomationInputSetup";
import { AutomationInputWithConfigs, AutomationWithVersions, AutomationVersionWithAllRelations } from "../types/prisma";

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
                        space_name: config.confluenceConfig.spaceName || null,
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
function transformInputConfig(input: any, id: string): AutomationInput {
    const base: AutomationInput = {
        id: id,
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
            spaceName: output.confluence_config.space_name || undefined,
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

// Helper functions for automation versions

/**
 * Find or create a draft version for a production automation
 */
async function findOrCreateDraftVersion(automationId: string, userId: string, tx: any): Promise<any> {
    // Check if draft already exists
    const existingDraft = await tx.automation_versions.findFirst({
        where: {
            automation_id: automationId,
            status: AutomationStatus.DRAFT,
            automation: {
                user_id: userId
            }
        },
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

    if (existingDraft) {
        return existingDraft;
    }

    // Find production version to copy from
    const productionVersion = await tx.automation_versions.findFirst({
        where: {
            automation_id: automationId,
            status: AutomationStatus.PRODUCTION,
            automation: {
                user_id: userId
            }
        },
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

    if (!productionVersion) {
        // No production version exists, create empty draft
        return await tx.automation_versions.create({
            data: {
                automation_id: automationId,
                status: AutomationStatus.DRAFT,
                is_active: false
            }
        });
    }

    // Copy production version to draft
    return await copyVersion(productionVersion, AutomationStatus.DRAFT, tx);
}

/**
 * Copy a version to a new version with specified status
 */
async function copyVersion(
    sourceVersion: any, 
    targetStatus: AutomationStatus, 
    tx: any,
    publishedBy?: string,
    publishedAt?: Date
): Promise<any> {
    // Create new version
    const newVersion = await tx.automation_versions.create({
        data: {
            automation_id: sourceVersion.automation_id,
            status: targetStatus,
            is_active: targetStatus === AutomationStatus.PRODUCTION, // Only active if production
            published_by: publishedBy || null,
            published_at: publishedAt || null
        }
    });

    // Copy prompt if exists
    if (sourceVersion.prompt) {
        await tx.automation_prompts.create({
            data: {
                automation_version_id: newVersion.id,
                content: sourceVersion.prompt.content
            }
        });
    }

    // Copy inputs
    for (const input of sourceVersion.inputs || []) {
        const newInput = await tx.automation_inputs.create({
            data: {
                automation_version_id: newVersion.id,
                integration_type: input.integration_type,
                integration_id: input.integration_id
            }
        });

        // Copy configs
        if (input.slack_config) {
            await tx.automation_slack_configs.create({
                data: {
                    automation_input_id: newInput.id,
                    channel_id: input.slack_config.channel_id,
                    channel_name: input.slack_config.channel_name,
                    listen_to_user_dms: input.slack_config.listen_to_user_dms
                }
            });
        }
        if (input.notion_config) {
            await tx.automation_notion_configs.create({
                data: {
                    automation_input_id: newInput.id,
                    database_id: input.notion_config.database_id,
                    database_name: input.notion_config.database_name
                }
            });
        }
        if (input.linear_config) {
            await tx.automation_linear_configs.create({
                data: {
                    automation_input_id: newInput.id,
                    project_id: input.linear_config.project_id,
                    project_name: input.linear_config.project_name
                }
            });
        }
        if (input.jira_config) {
            await tx.automation_jira_configs.create({
                data: {
                    automation_input_id: newInput.id,
                    project_key: input.jira_config.project_key,
                    project_id: input.jira_config.project_id
                }
            });
        }
        if (input.confluence_config) {
            await tx.automation_confluence_configs.create({
                data: {
                    automation_input_id: newInput.id,
                    space_id: input.confluence_config.space_id,
                    space_name: input.confluence_config.space_name,
                    page_id: input.confluence_config.page_id,
                    page_name: input.confluence_config.page_name
                }
            });
        }
        if (input.github_config) {
            await tx.automation_github_configs.create({
                data: {
                    automation_input_id: newInput.id,
                    repository_id: input.github_config.repository_id
                }
            });
        }
        if (input.gmail_config) {
            await tx.automation_gmail_configs.create({
                data: {
                    automation_input_id: newInput.id
                }
            });
        }
        if (input.figma_config) {
            await tx.automation_figma_configs.create({
                data: {
                    automation_input_id: newInput.id,
                    file_key: input.figma_config.file_key,
                    file_name: input.figma_config.file_name,
                    team_id: input.figma_config.team_id
                }
            });
        }
    }

    // Copy output if exists
    if (sourceVersion.output) {
        const newOutput = await tx.automation_outputs.create({
            data: {
                automation_version_id: newVersion.id,
                integration_type: sourceVersion.output.integration_type,
                integration_id: sourceVersion.output.integration_id
            }
        });

        // Copy output configs
        if (sourceVersion.output.slack_config) {
            await tx.automation_slack_configs.create({
                data: {
                    automation_output_id: newOutput.id,
                    channel_id: sourceVersion.output.slack_config.channel_id,
                    channel_name: sourceVersion.output.slack_config.channel_name
                }
            });
        }
        if (sourceVersion.output.notion_config) {
            await tx.automation_notion_configs.create({
                data: {
                    automation_output_id: newOutput.id,
                    database_id: sourceVersion.output.notion_config.database_id,
                    database_name: sourceVersion.output.notion_config.database_name
                }
            });
        }
        if (sourceVersion.output.notion_page_config) {
            await tx.automation_notion_page_configs.create({
                data: {
                    automation_output_id: newOutput.id,
                    page_id: sourceVersion.output.notion_page_config.page_id,
                    page_name: sourceVersion.output.notion_page_config.page_name
                }
            });
        }
        if (sourceVersion.output.linear_config) {
            await tx.automation_linear_configs.create({
                data: {
                    automation_output_id: newOutput.id,
                    project_id: sourceVersion.output.linear_config.project_id,
                    project_name: sourceVersion.output.linear_config.project_name
                }
            });
        }
        if (sourceVersion.output.jira_config) {
            await tx.automation_jira_configs.create({
                data: {
                    automation_output_id: newOutput.id,
                    project_key: sourceVersion.output.jira_config.project_key,
                    project_id: sourceVersion.output.jira_config.project_id
                }
            });
        }
        if (sourceVersion.output.confluence_config) {
            await tx.automation_confluence_configs.create({
                data: {
                    automation_output_id: newOutput.id,
                    space_id: sourceVersion.output.confluence_config.space_id,
                    space_name: sourceVersion.output.confluence_config.space_name,
                    page_id: sourceVersion.output.confluence_config.page_id,
                    page_name: sourceVersion.output.confluence_config.page_name
                }
            });
        }
        if (sourceVersion.output.github_config) {
            await tx.automation_github_configs.create({
                data: {
                    automation_output_id: newOutput.id,
                    repository_id: sourceVersion.output.github_config.repository_id
                }
            });
        }
        if (sourceVersion.output.gmail_config) {
            await tx.automation_gmail_configs.create({
                data: {
                    automation_output_id: newOutput.id
                }
            });
        }
        if (sourceVersion.output.figma_config) {
            await tx.automation_figma_configs.create({
                data: {
                    automation_output_id: newOutput.id,
                    file_key: sourceVersion.output.figma_config.file_key,
                    file_name: sourceVersion.output.figma_config.file_name,
                    team_id: sourceVersion.output.figma_config.team_id
                }
            });
        }
    }

    return newVersion;
}

/**
 * Copy a version (typically production) to a new draft version
 */
async function copyVersionToDraft(sourceVersion: any, tx: any): Promise<any> {
    // Create new draft version
    const draftVersion = await tx.automation_versions.create({
        data: {
            automation_id: sourceVersion.automation_id,
            status: AutomationStatus.DRAFT,
            is_active: false
        }
    });

    // Copy prompt if exists
    if (sourceVersion.prompt) {
        await tx.automation_prompts.create({
            data: {
                automation_version_id: draftVersion.id,
                content: sourceVersion.prompt.content
            }
        });
    }

    // Copy inputs
    for (const input of sourceVersion.inputs || []) {
        const newInput = await tx.automation_inputs.create({
            data: {
                automation_version_id: draftVersion.id,
                integration_type: input.integration_type,
                integration_id: input.integration_id
            }
        });

        // Copy configs
        if (input.slack_config) {
            await tx.automation_slack_configs.create({
                data: {
                    automation_input_id: newInput.id,
                    channel_id: input.slack_config.channel_id,
                    channel_name: input.slack_config.channel_name,
                    listen_to_user_dms: input.slack_config.listen_to_user_dms
                }
            });
        }
        if (input.notion_config) {
            await tx.automation_notion_configs.create({
                data: {
                    automation_input_id: newInput.id,
                    database_id: input.notion_config.database_id,
                    database_name: input.notion_config.database_name
                }
            });
        }
        if (input.linear_config) {
            await tx.automation_linear_configs.create({
                data: {
                    automation_input_id: newInput.id,
                    project_id: input.linear_config.project_id,
                    project_name: input.linear_config.project_name
                }
            });
        }
        if (input.jira_config) {
            await tx.automation_jira_configs.create({
                data: {
                    automation_input_id: newInput.id,
                    project_key: input.jira_config.project_key,
                    project_id: input.jira_config.project_id
                }
            });
        }
        if (input.github_config) {
            await tx.automation_github_configs.create({
                data: {
                    automation_input_id: newInput.id,
                    repository_id: input.github_config.repository_id
                }
            });
        }
        if (input.gmail_config) {
            await tx.automation_gmail_configs.create({
                data: {
                    automation_input_id: newInput.id
                }
            });
        }
        if (input.figma_config) {
            await tx.automation_figma_configs.create({
                data: {
                    automation_input_id: newInput.id,
                    file_key: input.figma_config.file_key,
                    file_name: input.figma_config.file_name,
                    team_id: input.figma_config.team_id
                }
            });
        }
    }

    // Copy output if exists
    if (sourceVersion.output) {
        const newOutput = await tx.automation_outputs.create({
            data: {
                automation_version_id: draftVersion.id,
                integration_type: sourceVersion.output.integration_type,
                integration_id: sourceVersion.output.integration_id
            }
        });

        // Copy output configs
        if (sourceVersion.output.slack_config) {
            await tx.automation_slack_configs.create({
                data: {
                    automation_output_id: newOutput.id,
                    channel_id: sourceVersion.output.slack_config.channel_id,
                    channel_name: sourceVersion.output.slack_config.channel_name
                }
            });
        }
        if (sourceVersion.output.notion_config) {
            await tx.automation_notion_configs.create({
                data: {
                    automation_output_id: newOutput.id,
                    database_id: sourceVersion.output.notion_config.database_id,
                    database_name: sourceVersion.output.notion_config.database_name
                }
            });
        }
        if (sourceVersion.output.notion_page_config) {
            await tx.automation_notion_page_configs.create({
                data: {
                    automation_output_id: newOutput.id,
                    page_id: sourceVersion.output.notion_page_config.page_id,
                    page_name: sourceVersion.output.notion_page_config.page_name
                }
            });
        }
        if (sourceVersion.output.linear_config) {
            await tx.automation_linear_configs.create({
                data: {
                    automation_output_id: newOutput.id,
                    project_id: sourceVersion.output.linear_config.project_id,
                    project_name: sourceVersion.output.linear_config.project_name
                }
            });
        }
        if (sourceVersion.output.jira_config) {
            await tx.automation_jira_configs.create({
                data: {
                    automation_output_id: newOutput.id,
                    project_key: sourceVersion.output.jira_config.project_key,
                    project_id: sourceVersion.output.jira_config.project_id
                }
            });
        }
        if (sourceVersion.output.confluence_config) {
            await tx.automation_confluence_configs.create({
                data: {
                    automation_output_id: newOutput.id,
                    space_id: sourceVersion.output.confluence_config.space_id,
                    space_name: sourceVersion.output.confluence_config.space_name,
                    page_id: sourceVersion.output.confluence_config.page_id,
                    page_name: sourceVersion.output.confluence_config.page_name
                }
            });
        }
        if (sourceVersion.output.github_config) {
            await tx.automation_github_configs.create({
                data: {
                    automation_output_id: newOutput.id,
                    repository_id: sourceVersion.output.github_config.repository_id
                }
            });
        }
        if (sourceVersion.output.gmail_config) {
            await tx.automation_gmail_configs.create({
                data: {
                    automation_output_id: newOutput.id
                }
            });
        }
        if (sourceVersion.output.figma_config) {
            await tx.automation_figma_configs.create({
                data: {
                    automation_output_id: newOutput.id,
                    file_key: sourceVersion.output.figma_config.file_key,
                    file_name: sourceVersion.output.figma_config.file_name,
                    team_id: sourceVersion.output.figma_config.team_id
                }
            });
        }
    }

    return draftVersion;
}

/**
 * Validate that a draft version has all required fields for publishing
 */
function validateVersionForPublishing(version: any): void {
    if (!version.name) {
        throw new Error('Automation name is required');
    }
    if (!version.inputs || version.inputs.length === 0) {
        throw new Error('At least one input is required');
    }
    if (!version.output) {
        throw new Error('Output is required');
    }
    if (!version.prompt || !version.prompt.content) {
        throw new Error('Prompt is required');
    }
}

/**
 * Get draft version for an automation
 */
async function getDraftVersion(automationId: string, userId: string): Promise<any> {
    const prisma = db();
    return await prisma.automation_versions.findFirst({
        where: {
            automation_id: automationId,
            status: AutomationStatus.DRAFT,
            automation: {
                user_id: userId
            }
        },
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
}

/**
 * Get production version for an automation
 */
async function getProductionVersion(automationId: string, userId: string): Promise<any> {
    const prisma = db();
    return await prisma.automation_versions.findFirst({
        where: {
            automation_id: automationId,
            status: AutomationStatus.PRODUCTION,
            is_active: true, // Only get the active production version
            automation: {
                user_id: userId
            }
        },
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
}

// GET /automations - List all automations with pagination (returns containers with versions)
export async function getUserAutomations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;

    // Parse pagination parameters (normalize to page/pageSize)
    const { page, pageSize, skip, take } = parsePageParams(req, 10, 100);

    // Optional filter by version status
    const status = req.query.status as string | undefined; // 'draft', 'production', or both

    // Optional search by name
    const search = req.query.search as string | undefined;

    try {
        const prisma = db();

        const where = {
            user_id: userId,
            ...(search && { name: { contains: search, mode: 'insensitive' as const } })
        };

        // Get total count for pagination
        const total = await prisma.automations.count({ where });

        // Get paginated automation containers
        const automations = await prisma.automations.findMany({
            where,
            include: {
                versions: {
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
                                notion_page_config: true,
                                linear_config: true,
                                jira_config: true,
                                confluence_config: true,
                                github_config: true,
                                gmail_config: true,
                                figma_config: true,
                            }
                        }
                    },
                    ...(status && {
                        where: {
                            status: status.toUpperCase() as AutomationStatus
                        }
                    })
                }
            },
            orderBy: { created_at: 'desc' },
            skip,
            take
        });

        // Transform the data to match frontend format
        const response = {
            automations: automations.map(automation => {
                // Get the LATEST draft version (by creation date, most recent first)
                const draftVersions = automation.versions
                    .filter(v => v.status === AutomationStatus.DRAFT)
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                const draftVersion = draftVersions[0]; // Get the most recent draft
                
                // Get the ACTIVE production version, not just any production version
                const productionVersion = automation.versions.find(v => 
                    v.status === AutomationStatus.PRODUCTION && v.is_active === true
                );

                // Use production version if available, otherwise draft
                const activeVersion = productionVersion || draftVersion;

                return {
                    id: automation.id,
                    name: automation.name,
                    isActive: productionVersion?.is_active || false,
                    draft: draftVersion ? {
                        id: draftVersion.id,
                        status: draftVersion.status,
                        prompt: draftVersion.prompt ? { text: draftVersion.prompt.content } : undefined,
                        inputs: draftVersion.inputs.map((input: AutomationInputWithConfigs) => transformInputConfig(input, input.id)),
                        output: draftVersion.output ? transformOutputConfig(draftVersion.output) : undefined
                    } : undefined,
                    production: productionVersion ? {
                        id: productionVersion.id,
                        status: productionVersion.status,
                        isActive: productionVersion.is_active,
                        prompt: productionVersion.prompt ? { text: productionVersion.prompt.content } : undefined,
                        inputs: productionVersion.inputs.map((input: AutomationInputWithConfigs) => transformInputConfig(input, input.id)),
                        output: productionVersion.output ? transformOutputConfig(productionVersion.output) : undefined
                    } : undefined,
                    // For backward compatibility, include the active version at the root level
                    prompt: activeVersion?.prompt ? { text: activeVersion.prompt.content } : undefined,
                    inputs: activeVersion?.inputs.map((input: AutomationInputWithConfigs) => transformInputConfig(input, input.id)) || [],
                    output: activeVersion?.output ? transformOutputConfig(activeVersion.output) : undefined
                };
            }),
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

// GET /automations/:id - Get single automation by ID (returns container with versions)
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
                versions: {
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
                }
            }
        });

        if (!automation) {
            res.status(404).json({ error: 'Automation not found' });
            return;
        }

        // Get the LATEST draft version (by creation date, most recent first)
        const draftVersions = automation.versions
            .filter(v => v.status === AutomationStatus.DRAFT)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const draftVersion = draftVersions[0]; // Get the most recent draft
        
        // Get the ACTIVE production version, not just any production version
        const productionVersion = automation.versions.find(v => 
            v.status === AutomationStatus.PRODUCTION && v.is_active === true
        );

        // Use production version if available, otherwise draft
        const activeVersion = productionVersion || draftVersion;

        // Transform the data to match frontend format
        const response: any = {
            id: automation.id,
            name: automation.name,
            isActive: productionVersion?.is_active || false,
            draft: draftVersion ? {
                id: draftVersion.id,
                status: draftVersion.status,
                prompt: draftVersion.prompt ? { text: draftVersion.prompt.content } : undefined,
                inputs: draftVersion.inputs.map((input: AutomationInputWithConfigs) => transformInputConfig(input, input.id)),
                output: draftVersion.output ? transformOutputConfig(draftVersion.output) : undefined
            } : undefined,
            production: productionVersion ? {
                id: productionVersion.id,
                status: productionVersion.status,
                isActive: productionVersion.is_active,
                prompt: productionVersion.prompt ? { text: productionVersion.prompt.content } : undefined,
                inputs: productionVersion.inputs.map((input: AutomationInputWithConfigs) => transformInputConfig(input, input.id)),
                output: productionVersion.output ? transformOutputConfig(productionVersion.output) : undefined
            } : undefined,
            // For backward compatibility, include the active version at the root level
            prompt: activeVersion?.prompt ? { text: activeVersion.prompt.content } : undefined,
            inputs: activeVersion?.inputs.map((input: AutomationInputWithConfigs) => transformInputConfig(input, input.id)) || [],
            output: activeVersion?.output ? transformOutputConfig(activeVersion.output) : undefined
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching automation:', error);
        res.status(500).json({ error: 'Failed to fetch automation' });
    }
}

// GET /automations/:id/versions - Get all versions of an automation
export async function getAutomationVersions(req: Request, res: Response) {
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
                versions: {
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
                                notion_page_config: true,
                                linear_config: true,
                                jira_config: true,
                                confluence_config: true,
                                github_config: true,
                                gmail_config: true,
                                figma_config: true,
                            }
                        }
                    },
                    orderBy: [
                        { status: 'asc' }, // DRAFT first, then PRODUCTION
                        { created_at: 'desc' } // Newest first within each status (for PRODUCTION versions)
                    ]
                }
            }
        });

        if (!automation) {
            res.status(404).json({ error: 'Automation not found' });
            return;
        }

        // Transform versions to API format
        // Type assertion needed because Prisma types may not include published_by/published_at yet
        const versions: AutomationVersion[] = automation.versions.map((version) => {
            const versionWithMetadata = version as AutomationVersionWithAllRelations;
            return {
                id: versionWithMetadata.id,
                status: versionWithMetadata.status,
                isActive: versionWithMetadata.is_active,
                createdAt: versionWithMetadata.created_at.toISOString(),
                updatedAt: versionWithMetadata.updated_at.toISOString(),
                publishedBy: versionWithMetadata.published_by || undefined,
                publishedAt: versionWithMetadata.published_at ? versionWithMetadata.published_at.toISOString() : undefined,
                prompt: versionWithMetadata.prompt ? { text: versionWithMetadata.prompt.content } : undefined,
                inputs: versionWithMetadata.inputs.map((input: AutomationInputWithConfigs) => transformInputConfig(input, input.id)),
                output: versionWithMetadata.output ? transformOutputConfig(versionWithMetadata.output) : undefined
            };
        });

        const response: AutomationVersionsResponse = {
            automationId: automation.id,
            automationName: automation.name,
            versions
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching automation versions:', error);
        res.status(500).json({ error: 'Failed to fetch automation versions' });
    }
}

interface SaveAutomationRequest {
    name: string;
    inputs: AutomationInput[];
    output: AutomationOutput;
    prompt: AutomationPrompt;
    isActive?: boolean;
}

// POST /automations - Create a new automation (always creates as DRAFT)
export async function createAutomation(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const { name, inputs, output, prompt } = req.body as Partial<SaveAutomationRequest>;
    console.log(chalk.green("Output from frontend:"), chalk.yellow(JSON.stringify(output, null, 2)));
    console.log(chalk.blue("Inputs from frontend:"), chalk.yellow(JSON.stringify(inputs, null, 2)));

    // Validate request - only require name for drafts
    if (!name) {
        res.status(400).json({ error: 'Invalid request: name is required' });
        return;
    }

    try {
        const prisma = db();

        // Create new automation container and draft version
        const result = await prisma.$transaction(async (tx) => {
            // Create automation container
            const newAutomation = await tx.automations.create({
                data: {
                    user_id: userId,
                    name
                }
            });

            // Create draft version
            const draftVersion = await tx.automation_versions.create({
                data: {
                    automation_id: newAutomation.id,
                    status: AutomationStatus.DRAFT,
                    is_active: false
                }
            });

            // Create prompt if provided
            if (prompt?.text) {
                await tx.automation_prompts.create({
                    data: {
                        automation_version_id: draftVersion.id,
                        content: prompt.text
                    }
                });
            }

            // Create inputs if provided
            if (inputs && inputs.length > 0) {
                for (const input of inputs) {
                    const integrationType = integrationTypeMap[input.integration];
                    if (!integrationType) {
                        throw new Error(`Unknown integration type: ${input.integration}`);
                    }

                    // Validate that user owns the integration
                    const integrationId = input.integrationId;
                    if (!integrationId) {
                        throw new Error(`Integration ID is required for ${input.integration}`);
                    }

                    const isOwner = await validateUserOwnsIntegration(userId, integrationType, integrationId);
                    if (!isOwner) {
                        throw new Error(`Integration ${input.integration} not found or not owned by user`);
                    }

                    const newInput = await tx.automation_inputs.create({
                        data: {
                            automation_version_id: draftVersion.id,
                            integration_type: integrationType,
                            integration_id: integrationId
                        }
                    });

                    // Create config record if provided
                    await createInputConfig(tx, newInput.id, integrationType, input);
                }
            }

            // Create output if provided
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

                console.log(chalk.green("Output integration ID:"), chalk.yellow(outputIntegrationId));
                console.log(chalk.green("Output integration type:"), chalk.yellow(outputIntegrationType));
                console.log(chalk.green("Creating new output:"), chalk.yellow(JSON.stringify(output, null, 2)));

                const newOutput = await tx.automation_outputs.create({
                    data: {
                        automation_version_id: draftVersion.id,
                        integration_type: outputIntegrationType,
                        integration_id: outputIntegrationId
                    }
                });

                // Create config record if provided
                await createOutputConfig(tx, newOutput.id, outputIntegrationType, output);
            }

            return { automation: newAutomation, version: draftVersion };
        });

        // Do NOT set up automation inputs for drafts - only for production
        // await AutomationInputSetup.setupAutomationInputs(result.version.id);

        res.status(201).json({ success: true, id: result.automation.id, versionId: result.version.id });
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
            // Find all active production versions (preserve history)
            const activeProductionVersions = await prisma.automation_versions.findMany({
                where: {
                    automation_id: existingAutomation.id,
                    status: AutomationStatus.PRODUCTION,
                    is_active: true
                }
            });

            // Tear down old production inputs (before transaction to avoid issues)
            for (const existingProduction of activeProductionVersions) {
                await AutomationInputSetup.tearDownAutomationInputs(existingProduction.id);
            }

            // Create new production version (preserving history)
            const now = new Date();
            const newProductionVersionId = await prisma.$transaction(async (tx) => {
                // Update automation name
                await tx.automations.update({
                    where: { id: existingAutomation.id },
                    data: { name }
                });

                // Deactivate all existing production versions (preserve history)
                if (activeProductionVersions.length > 0) {
                    await tx.automation_versions.updateMany({
                        where: {
                            automation_id: existingAutomation.id,
                            status: AutomationStatus.PRODUCTION,
                            is_active: true
                        },
                        data: {
                            is_active: false
                        }
                    });
                }

                // Create new production version
                const newVersion = await tx.automation_versions.create({
                    data: {
                        automation_id: existingAutomation.id,
                        status: AutomationStatus.PRODUCTION,
                        is_active: true,
                        published_by: userId,
                        published_at: now
                    } as Prisma.automation_versionsUncheckedCreateInput
                });

                // Create prompt
                await tx.automation_prompts.create({
                    data: {
                        automation_version_id: newVersion.id,
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
                    const integrationId = input.integrationId;
                    if (!integrationId) {
                        throw new Error(`Integration ID is required for ${input.integration}`);
                    }

                    const isOwner = await validateUserOwnsIntegration(userId, integrationType, integrationId);
                    if (!isOwner) {
                        throw new Error(`Integration ${input.integration} not found or not owned by user`);
                    }

                    const newInput = await tx.automation_inputs.create({
                        data: {
                            automation_version_id: newVersion.id,
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

                const outputIntegrationId = output.integrationId;
                if (!outputIntegrationId) {
                    throw new Error(`Integration ID is required for ${output.integration}`);
                }

                const isOwner = await validateUserOwnsIntegration(userId, outputIntegrationType, outputIntegrationId);
                if (!isOwner) {
                    throw new Error(`Integration ${output.integration} not found or not owned by user`);
                }

                const newOutput = await tx.automation_outputs.create({
                    data: {
                        automation_version_id: newVersion.id,
                        integration_type: outputIntegrationType,
                        integration_id: outputIntegrationId
                    }
                });

                // Create config record if provided
                await createOutputConfig(tx, newOutput.id, outputIntegrationType, output);

                return newVersion.id;
            });

            // Set up automation inputs for the newly created version
            await AutomationInputSetup.setupAutomationInputs(newProductionVersionId);

            res.status(200).json({ success: true, id: existingAutomation.id, versionId: newProductionVersionId });
        } else {
            // Create new automation
            const result = await prisma.$transaction(async (tx) => {
                // Create automation container
                const newAutomation = await tx.automations.create({
                    data: {
                        user_id: userId,
                        name
                    }
                });

                // Create production version
                const now = new Date();
                const productionVersion = await tx.automation_versions.create({
                    data: {
                        automation_id: newAutomation.id,
                        status: AutomationStatus.PRODUCTION,
                        is_active: true,
                        published_by: userId,
                        published_at: now
                    } as Prisma.automation_versionsUncheckedCreateInput
                });

                // Create prompt
                await tx.automation_prompts.create({
                    data: {
                        automation_version_id: productionVersion.id,
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
                    const integrationId = input.integrationId;
                    if (!integrationId) {
                        throw new Error(`Integration ID is required for ${input.integration}`);
                    }

                    const isOwner = await validateUserOwnsIntegration(userId, integrationType, integrationId);
                    if (!isOwner) {
                        throw new Error(`Integration ${input.integration} not found or not owned by user`);
                    }

                    const newInput = await tx.automation_inputs.create({
                        data: {
                            automation_version_id: productionVersion.id,
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

                const outputIntegrationId = output.integrationId;
                if (!outputIntegrationId) {
                    throw new Error(`Integration ID is required for ${output.integration}`);
                }

                const isOwner = await validateUserOwnsIntegration(userId, outputIntegrationType, outputIntegrationId);
                if (!isOwner) {
                    throw new Error(`Integration ${output.integration} not found or not owned by user`);
                }

                const newOutput = await tx.automation_outputs.create({
                    data: {
                        automation_version_id: productionVersion.id,
                        integration_type: outputIntegrationType,
                        integration_id: outputIntegrationId
                    }
                });

                // Create config record if provided
                await createOutputConfig(tx, newOutput.id, outputIntegrationType, output);

                return { automation: newAutomation, version: productionVersion };
            });

            // Set up automation inputs (e.g., create webhooks for Figma)
            await AutomationInputSetup.setupAutomationInputs(result.version.id);

            res.status(201).json({ success: true, id: result.automation.id });
        }
    } catch (error) {
        console.error('Error saving automation:', error);
        res.status(500).json({ error: 'Failed to save automation', details: (error as Error).message });
    }
}

// PATCH /automations/:id - Update an existing automation (always updates draft, never production)
export async function updateAutomation(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const automationId = req.params.id;
    const { name, inputs, output, prompt } = req.body as Partial<SaveAutomationRequest>;

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
        const result = await prisma.$transaction(async (tx) => {
            // Update automation container name if provided
            if (name !== undefined) {
                await tx.automations.update({
                    where: { id: automationId },
                    data: { name }
                });
            }

            // Find or create draft version
            const draftVersion = await findOrCreateDraftVersion(automationId, userId, tx);

            // Update prompt if provided
            if (prompt?.text !== undefined) {
                const existingPrompt = await tx.automation_prompts.findUnique({
                    where: { automation_version_id: draftVersion.id }
                });

                if (existingPrompt) {
                    await tx.automation_prompts.update({
                        where: { id: existingPrompt.id },
                        data: { content: prompt.text }
                    });
                } else {
                    await tx.automation_prompts.create({
                        data: {
                            automation_version_id: draftVersion.id,
                            content: prompt.text
                        }
                    });
                }
            }

            // Update inputs if provided
            if (inputs !== undefined) {
                // Delete old inputs (configs cascade delete)
                await tx.automation_inputs.deleteMany({
                    where: { automation_version_id: draftVersion.id }
                });

                // Create new inputs
                if (inputs.length > 0) {
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
                                automation_version_id: draftVersion.id,
                                integration_type: integrationType,
                                integration_id: integrationId
                            }
                        });

                        // Create config record if provided
                        await createInputConfig(tx, newInput.id, integrationType, input);
                    }
                }
            }

            // Update output if provided
            if (output !== undefined) {
                // Delete old output (configs cascade delete)
                const existingOutput = await tx.automation_outputs.findUnique({
                    where: { automation_version_id: draftVersion.id }
                });
                if (existingOutput) {
                    await tx.automation_outputs.delete({
                        where: { automation_version_id: draftVersion.id }
                    });
                }

                // Create new output if provided
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

                    const newOutput = await tx.automation_outputs.create({
                        data: {
                            automation_version_id: draftVersion.id,
                            integration_type: outputIntegrationType,
                            integration_id: outputIntegrationId
                        }
                    });

                    // Create config record if provided
                    await createOutputConfig(tx, newOutput.id, outputIntegrationType, output);
                }
            }

            return { automation: existingAutomation, version: draftVersion };
        });

        // Do NOT set up automation inputs for drafts - only for production
        // await AutomationInputSetup.setupAutomationInputs(result.version.id);

        res.status(200).json({ success: true, id: automationId, versionId: result.version.id });
    } catch (error) {
        console.error('Error updating automation:', error);
        res.status(500).json({ error: 'Failed to update automation', details: (error as Error).message });
    }
}

// POST /automations/:id/publish - Publish a draft to production
export async function publishAutomation(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const automationId = req.params.id;

    try {
        const prisma = db();

        // Check if automation exists and belongs to user
        const automation = await prisma.automations.findFirst({
            where: {
                id: automationId,
                user_id: userId
            }
        });

        if (!automation) {
            res.status(404).json({ error: 'Automation not found' });
            return;
        }

        // Find draft version
        const draftVersion = await getDraftVersion(automationId, userId);
        if (!draftVersion) {
            res.status(404).json({ error: 'Draft version not found' });
            return;
        }

        // Validate draft has all required fields
        try {
            validateVersionForPublishing({
                name: automation.name,
                inputs: draftVersion.inputs || [],
                output: draftVersion.output,
                prompt: draftVersion.prompt
            });
        } catch (validationError) {
            res.status(400).json({ error: 'Draft is not ready for publishing', details: (validationError as Error).message });
            return;
        }

        // Find all active production versions (before transaction)
        const activeProductionVersions = await prisma.automation_versions.findMany({
            where: {
                automation_id: automationId,
                status: AutomationStatus.PRODUCTION,
                is_active: true
            }
        });

        // Tear down old production inputs (before transaction to avoid issues)
        for (const existingProduction of activeProductionVersions) {
            await AutomationInputSetup.tearDownAutomationInputs(existingProduction.id);
        }

        // Publish draft to production (preserving version history)
        const newProductionVersionId = await prisma.$transaction(async (tx) => {
            // Deactivate all existing production versions (preserve history)
            if (activeProductionVersions.length > 0) {
                await tx.automation_versions.updateMany({
                    where: {
                        automation_id: automationId,
                        status: AutomationStatus.PRODUCTION,
                        is_active: true
                    },
                    data: {
                        is_active: false
                    }
                });
            }

            // Copy draft to a new production version (keep draft for continued editing)
            const now = new Date();
            const newProductionVersion = await copyVersion(
                draftVersion, 
                AutomationStatus.PRODUCTION, 
                tx,
                userId, // published_by
                now     // published_at
            );
            return newProductionVersion.id;
        });

        // Set up automation inputs for the newly published version
        await AutomationInputSetup.setupAutomationInputs(newProductionVersionId);

        res.status(200).json({ success: true, id: automationId, versionId: newProductionVersionId });
    } catch (error) {
        console.error('Error publishing automation:', error);
        res.status(500).json({ error: 'Failed to publish automation', details: (error as Error).message });
    }
}

// POST /automations/:id/revert - Revert draft and return to production
export async function revertAutomation(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const automationId = req.params.id;

    try {
        const prisma = db();

        // Check if automation exists and belongs to user
        const automation = await prisma.automations.findFirst({
            where: {
                id: automationId,
                user_id: userId
            }
        });

        if (!automation) {
            res.status(404).json({ error: 'Automation not found' });
            return;
        }

        // Find draft version
        const draftVersion = await getDraftVersion(automationId, userId);
        if (!draftVersion) {
            res.status(404).json({ error: 'Draft version not found' });
            return;
        }

        // Get production version before deleting draft
        const productionVersion = await getProductionVersion(automationId, userId);

        // Delete draft version
        await prisma.automation_versions.delete({
            where: { id: draftVersion.id }
        });

        // Return production version data
        if (productionVersion) {
            const response: Automation = {
                id: automation.id,
                name: automation.name,
                isActive: productionVersion.is_active,
                prompt: productionVersion.prompt ? { text: productionVersion.prompt.content } : undefined,
                inputs: productionVersion.inputs.map((input: AutomationInputWithConfigs) => transformInputConfig(input, input.id)),
                output: productionVersion.output ? transformOutputConfig(productionVersion.output) : undefined
            };
            res.status(200).json(response);
        } else {
            // No production version exists
            res.status(200).json({
                id: automation.id,
                name: automation.name,
                isActive: false,
                prompt: undefined,
                inputs: [],
                output: undefined
            });
        }
    } catch (error) {
        console.error('Error reverting automation:', error);
        res.status(500).json({ error: 'Failed to revert automation', details: (error as Error).message });
    }
}

// POST /automations/:id/versions/:versionId/activate - Activate a previous PRODUCTION version (rollback)
export async function activateAutomationVersion(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const automationId = req.params.id;
    const versionId = req.params.versionId;

    try {
        const prisma = db();

        // Check if automation exists and belongs to user
        const automation = await prisma.automations.findFirst({
            where: {
                id: automationId,
                user_id: userId
            }
        });

        if (!automation) {
            res.status(404).json({ error: 'Automation not found' });
            return;
        }

        // Find the version to activate
        const versionToActivate = await prisma.automation_versions.findFirst({
            where: {
                id: versionId,
                automation_id: automationId,
                status: AutomationStatus.PRODUCTION
            }
        });

        if (!versionToActivate) {
            res.status(404).json({ error: 'Version not found or is not a PRODUCTION version' });
            return;
        }

        // Find all active production versions (before transaction)
        const activeProductionVersions = await prisma.automation_versions.findMany({
            where: {
                automation_id: automationId,
                status: AutomationStatus.PRODUCTION,
                is_active: true
            }
        });

        // Tear down old production inputs (before transaction to avoid issues)
        for (const existingProduction of activeProductionVersions) {
            await AutomationInputSetup.tearDownAutomationInputs(existingProduction.id);
        }

        // Activate the specified version
        await prisma.$transaction(async (tx) => {
            // Deactivate all existing production versions
            if (activeProductionVersions.length > 0) {
                await tx.automation_versions.updateMany({
                    where: {
                        automation_id: automationId,
                        status: AutomationStatus.PRODUCTION,
                        is_active: true
                    },
                    data: {
                        is_active: false
                    }
                });
            }

            // Activate the specified version
            await tx.automation_versions.update({
                where: { id: versionId },
                data: {
                    is_active: true,
                    // Update published metadata to reflect reactivation
                    published_by: userId,
                    published_at: new Date()
                } as Prisma.automation_versionsUncheckedUpdateInput
            });
        });

        // Set up automation inputs for the newly activated version
        await AutomationInputSetup.setupAutomationInputs(versionId);

        res.status(200).json({ 
            success: true, 
            id: automationId, 
            versionId: versionId,
            message: 'Version activated successfully' 
        });
    } catch (error) {
        console.error('Error activating automation version:', error);
        res.status(500).json({ error: 'Failed to activate automation version', details: (error as Error).message });
    }
}

// DELETE /automations/:id - Delete an automation container (cascade deletes all versions)
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
            include: {
                versions: {
                    where: {
                        status: AutomationStatus.PRODUCTION
                    }
                }
            }
        });

        if (!existingAutomation) {
            res.status(404).json({ error: 'Automation not found' });
            return;
        }

        // Tear down production version inputs (e.g., delete webhooks for Figma)
        for (const productionVersion of existingAutomation.versions) {
            await AutomationInputSetup.tearDownAutomationInputs(productionVersion.id);
        }

        // Delete automation container (cascade will delete all versions and related records)
        await prisma.automations.delete({
            where: { id: automationId }
        });

        res.status(200).json({ success: true, message: 'Automation deleted successfully' });
    } catch (error) {
        console.error('Error deleting automation:', error);
        res.status(500).json({ error: 'Failed to delete automation', details: (error as Error).message });
    }
}
