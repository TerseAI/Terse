import { Request, Response } from "express";
import { db } from "../prismaClient";
import chalk from "chalk";
import { LinearAdapter } from "../ticketing/linear";
import { findUserById, getUserTicketManager } from "../types/user";
import { LinearWebhookPayload } from "../utility/LinearWebhookPayload";
import { search } from "../searchClient";

export const setLinearApiKey = async (req: Request, res: Response) => {
    let user = req.session?.user;
    if (!user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { apiKey, teamId } = req.body;
    console.log(chalk.blue("🔑 Adding Linear API key for user"), chalk.yellow(user.id));

    try {
        // Validate the API key before storing
        const isValid = await LinearAdapter.validateKey(apiKey);
        if (!isValid) {
            return res.status(400).json({ success: false, error: 'Invalid API key' });
        }

        let adapter = new LinearAdapter(apiKey);

        const configureWebhook = await adapter.configureWebhook();
        if (!configureWebhook) {
            return res.status(500).json({ success: false, error: 'Failed to configure webhook' });
        }

        let linearUser = await adapter.me();
        if (!linearUser) {
            return res.status(500).json({ success: false, error: 'Failed to fetch user information' });
        }

        // Fetch workspace and team info
        const userContext = await adapter.getUserContext();
        const organization = userContext.organization;

        let teamName = null;
        if (teamId) {
            const team = userContext.teams.find(t => t.id === teamId);
            teamName = team?.name || null;
        }

        const connection = await db().linear_api_keys.create({
            data: {
                user_id: user.id,
                linear_user_id: linearUser.id,
                workspace_id: organization.name, // Using name as ID for now
                workspace_name: organization.name,
                team_id: teamId || null,
                team_name: teamName,
                api_key: apiKey,
                webhook_id: configureWebhook.webhookId,
                webhook_secret: configureWebhook.webhookSecret
            }
        });

        console.log(chalk.green('✅ Created Linear integration:'), chalk.yellow(`${organization.name}${teamName ? ` (${teamName})` : ''}`));

        return res.status(200).json({
            success: true,
            connection: {
                id: connection.id,
                workspaceId: connection.workspace_id,
                workspaceName: connection.workspace_name,
                teamId: connection.team_id,
                teamName: connection.team_name
            }
        });
    } catch (error) {
        console.error(chalk.red('Error creating Linear connection:'), error);
        return res.status(500).json({ success: false, error: 'Failed to create connection' });
    }
}

export const validateLinearApiKey = async (req: Request, res: Response) => {
    let user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { apiKey } = req.body;
    if (!apiKey) {
        return res.status(400).json({ error: 'API key is required' });
    }

    try {
        // Validate the API key
        const isValid = await LinearAdapter.validateKey(apiKey);
        if (!isValid) {
            return res.status(400).json({ valid: false, error: 'Invalid API key' });
        }

        // Fetch workspace and teams
        const adapter = new LinearAdapter(apiKey);
        const userContext = await adapter.getUserContext();
        const organization = userContext.organization;

        return res.status(200).json({
            valid: true,
            workspace: {
                name: organization.name,
                id: organization.name // Using name as ID for now
            },
            teams: userContext.teams.map(team => ({
                id: team.id,
                name: team.name,
                key: team.key
            }))
        });
    } catch (error) {
        console.error(chalk.red('Error validating Linear API key:'), error);
        return res.status(500).json({ valid: false, error: 'Failed to validate API key' });
    }
}

export const getLinearApiKey = async (req: Request, res: Response) => {
    let user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const linearApiKey = await db().linear_api_keys.findFirst({
        where: {
            user_id: user.id
        }
    });

    if (!linearApiKey) {
        console.log("No Linear API key found for user", user.id);
        return res.status(404).json({ error: 'Linear API key not found' });
    }

    // check if the key is valid
    const isValid = await LinearAdapter.validateKey(linearApiKey.api_key);
    if (!isValid) {
        console.log(chalk.red('Invalid Linear API key. Removing key for database along with webhook'));
        await db().linear_api_keys.delete({
            where: {
                id: linearApiKey.id
            }
        });
        return res.status(400).json({ error: 'Invalid Linear API key. Removing key for database along with webhook' });
    }

    res.status(200).json({ apiKey: linearApiKey.api_key });
}

export const indexLinearTicket = async (linerarUserId: string, body: LinearWebhookPayload) => {
    // check list of linear integrations for this user
    let linearIntegrations = await db().linear_api_keys.findFirst({
        where: {
            linear_user_id: linerarUserId
        }
    });

    if (!linearIntegrations) {
        console.log("No Linear integrations found for user", linerarUserId);
        return null;
    }

    let userId = linearIntegrations.user_id;
    
    let user = await findUserById(userId);
    if (!user) {
        return null;
    }

    const ticketManager = await getUserTicketManager(user.id);
    if (!ticketManager) {
        return null;
    }

    let ticketId = body.data.id;

    let searchItems = await ticketManager.searchItemsForTicket(ticketId);
    if (searchItems.length === 0) {
        return null;
    }

    await search().bulkInsert(searchItems);

    console.log(chalk.green("✅ Indexed ticket"), chalk.yellow(ticketId));
}

export const deleteLinearCredentials = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { integrationId } = req.body;

    if (!integrationId) {
        return res.status(400).json({ error: 'Integration ID is required' });
    }

    // Verify the integration belongs to the user
    const linearApiKey = await db().linear_api_keys.findFirst({
        where: {
            id: integrationId,
            user_id: user.id
        }
    });

    if (!linearApiKey) {
        return res.status(404).json({ error: 'Linear integration not found' });
    }

    // Tear down webhook
    const adapter = new LinearAdapter(linearApiKey.api_key);
    await adapter.tearDownWebhook(linearApiKey.webhook_id);

    // Clean up automation inputs/outputs that reference this Linear integration
    await db().automation_inputs.deleteMany({
        where: {
            integration_type: 'LINEAR',
            integration_id: linearApiKey.id
        }
    });

    await db().automation_outputs.deleteMany({
        where: {
            integration_type: 'LINEAR',
            integration_id: linearApiKey.id
        }
    });

    await db().linear_api_keys.delete({ where: { id: integrationId } });
    console.log(chalk.green('Deleted Linear credentials for user'), chalk.yellow(user.id));

    res.status(200).json({ message: 'Credentials deleted' });
}