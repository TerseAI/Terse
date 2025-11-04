import { InputSetupHandler } from '../AutomationInputSetup';
import { db } from '../../prismaClient';
import { IntegrationType } from '@prisma/client';
import chalk from 'chalk';

/**
 * Figma input setup handler.
 * Creates webhooks for Figma files when automations are set up.
 */
export class FigmaInputSetup implements InputSetupHandler {
    async setup(integrationId: string, automationInput: any): Promise<void> {
        // Check if figma_config exists at all
        if (!automationInput.figma_config) {
            console.log(chalk.yellow(`⚠️  No Figma config found for input ${automationInput.id}. Skipping webhook setup.`));
            return;
        }

        const fileKey = automationInput.figma_config.file_key;
        
        if (!fileKey) {
            console.log(chalk.yellow(`⚠️  No file_key specified in Figma config for input ${automationInput.id}`));
            return;
        }

        // Get Figma integration
        const figmaIntegration = await db().figma_integrations.findFirst({
            where: { id: integrationId },
        });

        console.log({ figmaIntegration, fileKey });

        if (!figmaIntegration) {
            console.log(chalk.yellow(`⚠️  Figma integration not found: ${integrationId}`));
            return;
        }

        // Check if webhook already exists for this automation input
        const existingWebhook = await db().figma_webhooks.findUnique({
            where: { automation_input_id: automationInput.id },
        });

        if (existingWebhook) {
            console.log(chalk.blue(`ℹ️  Webhook already exists for automation input ${automationInput.id}`));
            return;
        }

        // Build webhook endpoint URL
        const webhookEndpoint = `${process.env.BACKEND_URL || process.env.FRONTEND_URL?.replace(/\/$/, '') || 'http://localhost:3001'}/webhooks/figma`;

        try {
            const accessToken = figmaIntegration.access_token;

            // Get team ID from config if available, otherwise fetch from file metadata
            let teamId = automationInput.figma_config?.team_id;

            // If team_id is not in config, fetch it from file metadata or project
            if (!teamId) {
                console.log(chalk.blue(`🔍 Fetching team_id for file ${fileKey} from Figma API...`));
                const metadataResponse = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    },
                });


                if (metadataResponse.ok) {
                    const metadata = await metadataResponse.json();
                    console.log({ metadata });
                    // File metadata structure can vary - try multiple possible locations
                    teamId = metadata.project?.team_id || 
                             metadata.team_id || 
                             metadata.team?.id ||
                             null;
                    
                    if (teamId) {
                        console.log(chalk.blue(`✅ Found team_id: ${teamId} for file ${fileKey}`));
                    } else {
                        // If we still don't have team_id, try fetching user's teams and matching
                        console.log(chalk.blue(`🔍 Attempting to find team by listing user's teams...`));
                        try {
                            const teamsResponse = await fetch('https://api.figma.com/v2/teams', {
                                method: 'GET',
                                headers: {
                                    'Authorization': `Bearer ${accessToken}`,
                                },
                            });
                            
                            if (teamsResponse.ok) {
                                const teamsData = await teamsResponse.json();
                                const teams = teamsData.teams || [];
                                
                                // Try to find which team contains this file by checking projects
                                for (const team of teams) {
                                    try {
                                        const projectsResponse = await fetch(`https://api.figma.com/v2/teams/${team.id}/projects`, {
                                            method: 'GET',
                                            headers: {
                                                'Authorization': `Bearer ${accessToken}`,
                                            },
                                        });
                                        
                                        if (projectsResponse.ok) {
                                            const projectsData = await projectsResponse.json();
                                            const projects = projectsData.projects || [];
                                            
                                            // Check if any project contains our file
                                            for (const project of projects) {
                                                try {
                                                    const projectFilesResponse = await fetch(`https://api.figma.com/v2/projects/${project.id}/files`, {
                                                        method: 'GET',
                                                        headers: {
                                                            'Authorization': `Bearer ${accessToken}`,
                                                        },
                                                    });
                                                    
                                                    if (projectFilesResponse.ok) {
                                                        const filesData = await projectFilesResponse.json();
                                                        const files = filesData.files || [];
                                                        if (files.some((f: any) => f.key === fileKey)) {
                                                            teamId = team.id;
                                                            console.log(chalk.blue(`✅ Found team_id: ${teamId} by matching file in team ${team.name}`));
                                                            break;
                                                        }
                                                    }
                                                } catch (error) {
                                                    // Continue checking other projects
                                                }
                                                
                                                if (teamId) break;
                                            }
                                        }
                                    } catch (error) {
                                        // Continue checking other teams
                                    }
                                    
                                    if (teamId) break;
                                }
                            }
                        } catch (error) {
                            console.log(chalk.yellow(`⚠️  Could not fetch teams: ${error}`));
                        }
                        
                        if (!teamId) {
                            console.log(chalk.yellow(`⚠️  Could not find team_id for file ${fileKey}`));
                        }
                    }
                } else {
                    const errorText = await metadataResponse.text();
                    console.error(chalk.yellow(`⚠️  Failed to fetch file metadata: ${errorText}`));
                }
            }

            // team_id is required for Figma webhooks
            if (!teamId) {
                throw new Error(`team_id is required for creating Figma webhooks. Could not find team_id for file ${fileKey}.`);
            }

            // Create webhook in Figma
            // Note: Figma webhooks can be created at team or file level
            // For file-level monitoring, we use the file_key
            const webhookResponse = await fetch('https://api.figma.com/v2/webhooks', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    event_type: 'FILE_UPDATE',
                    team_id: teamId,
                    file_key: fileKey, // File to monitor
                    endpoint: webhookEndpoint,
                }),
            });

            if (!webhookResponse.ok) {
                const errorText = await webhookResponse.text();
                console.error(chalk.red(`Failed to create Figma webhook: ${errorText}`));
                throw new Error(`Failed to create Figma webhook: ${errorText}`);
            }

            const webhookData = await webhookResponse.json();
            const webhookId = webhookData.webhook?.id || webhookData.id;

            if (!webhookId) {
                throw new Error('Webhook ID not returned from Figma API');
            }

            // Store webhook in database
            await db().figma_webhooks.create({
                data: {
                    figma_integration_id: figmaIntegration.id,
                    automation_input_id: automationInput.id,
                    webhook_id: webhookId,
                    file_key: fileKey,
                    team_id: teamId || null,
                    endpoint_url: webhookEndpoint,
                },
            });

            console.log(
                chalk.green(`✅ Created Figma webhook ${webhookId} for file ${fileKey} (automation input ${automationInput.id})`)
            );
        } catch (error) {
            console.error(chalk.red(`❌ Error creating Figma webhook for file ${fileKey}:`), error);
            throw error;
        }
    }

    async tearDown(integrationId: string, automationInput: any): Promise<void> {
        const fileKey = automationInput.figma_config?.file_key;

        // Find the webhook for this automation input
        const webhook = await db().figma_webhooks.findUnique({
            where: { automation_input_id: automationInput.id },
            include: {
                figma_integration: true,
            },
        });

        if (!webhook) {
            console.log(chalk.blue(`ℹ️  No webhook found for automation input ${automationInput.id}`));
            return;
        }

        // Check if any other active automations are using this file
        const otherAutomations = await db().automation_inputs.findMany({
            where: {
                integration_type: IntegrationType.FIGMA,
                automation: {
                    is_active: true,
                },
                NOT: {
                    id: automationInput.id,
                },
            },
            include: {
                figma_config: true,
            },
        });

        const stillInUse = otherAutomations.some(
            (input) => input.figma_config?.file_key === fileKey
        );

        // Always delete the webhook - each automation input gets its own webhook
        try {
            const accessToken = webhook.figma_integration.access_token;

            const deleteResponse = await fetch(`https://api.figma.com/v2/webhooks/${webhook.webhook_id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (!deleteResponse.ok && deleteResponse.status !== 404) {
                // 404 means webhook already deleted, which is fine
                const errorText = await deleteResponse.text();
                console.error(chalk.red(`Failed to delete Figma webhook: ${errorText}`));
            } else {
                console.log(chalk.green(`✅ Deleted Figma webhook ${webhook.webhook_id}`));
            }
        } catch (error) {
            console.error(chalk.red(`❌ Error deleting Figma webhook ${webhook.webhook_id}:`), error);
            // Continue with database cleanup even if API call fails
        }

        // Delete webhook record from database
        await db().figma_webhooks.delete({
            where: { id: webhook.id },
        });

        if (!stillInUse) {
            console.log(chalk.blue(`📤 File ${fileKey} no longer monitored by any automations`));
        }
    }
}

