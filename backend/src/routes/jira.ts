import { Request, Response } from "express";
import chalk from "chalk";
import { db } from "../prismaClient";
import { JiraAdapter } from "../ticketing/jira";
import { JiraWebhookPayload } from "../utility/JiraWebhookPayload";
import { findUserById, getUserTicketManager } from "../types/user";
import { search } from "../searchClient";

export const setJiraCredentials = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { baseUrl, apiKey, email, projectKey } = req.body;
    console.log(req.body);
    console.log("Attempting to set Jira credentials", baseUrl, email, apiKey);

    try {
        const valid = await JiraAdapter.validateCredentials(baseUrl, email, apiKey);
        if (!valid) {
            return res.status(400).json({ success: false, error: 'Invalid credentials' });
        }

        let adapter = new JiraAdapter({ baseUrl: baseUrl, email: email, apiToken: apiKey });

        const configureWebhook = await adapter.configureWebhook();
        if (!configureWebhook) {
            return res.status(500).json({ success: false, error: 'Failed to configure webhook' });
        }

        // Extract site name from baseUrl
        let siteName = baseUrl;
        const siteNameMatch = baseUrl.match(/https?:\/\/([^.]+)/);
        if (siteNameMatch) {
            siteName = siteNameMatch[1];
        }

        // Try to fetch project name if projectKey is provided
        let projectName = null;
        if (projectKey) {
            try {
                const teams = await adapter.getTeams();
                const project = teams.find(t => t.key === projectKey);
                if (project) {
                    projectName = project.name;
                }
            } catch (error) {
                console.warn(chalk.yellow('Could not fetch project name for'), projectKey);
            }
        }

        const connection = await db().jira_api_keys.create({
            data: {
                user_id: user.id,
                jira_user_email: email,
                base_url: baseUrl,
                site_name: siteName,
                project_key: projectKey || null,
                project_name: projectName,
                api_token: apiKey,
                webhook_id: configureWebhook.webhookId,
            }
        });

        console.log(chalk.green('✅ Created Jira integration:'), chalk.yellow(`${siteName}${projectName ? ` (${projectName})` : ''}`));
        
        return res.status(200).json({
            success: true,
            connection: {
                id: connection.id,
                baseUrl: connection.base_url,
                siteName: connection.site_name,
                email: connection.jira_user_email,
                projectKey: connection.project_key,
                projectName: connection.project_name
            }
        });
    } catch (error) {
        console.error(chalk.red('Error creating Jira connection:'), error);
        return res.status(500).json({ success: false, error: 'Failed to create connection' });
    }
};

export const validateJiraCredentials = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { baseUrl, email, apiKey } = req.body;
    if (!baseUrl || !email || !apiKey) {
        return res.status(400).json({ error: 'baseUrl, email, and apiKey are required' });
    }

    try {
        // Validate credentials
        const valid = await JiraAdapter.validateCredentials(baseUrl, email, apiKey);
        if (!valid) {
            return res.status(400).json({ valid: false, error: 'Invalid credentials' });
        }

        // Fetch projects
        const adapter = new JiraAdapter({ baseUrl, email, apiToken: apiKey });
        const teams = await adapter.getTeams();

        return res.status(200).json({
            valid: true,
            projects: teams.map(team => ({
                id: team.id,
                key: team.key,
                name: team.name
            }))
        });
    } catch (error) {
        console.error(chalk.red('Error validating Jira credentials:'), error);
        return res.status(500).json({ valid: false, error: 'Failed to validate credentials' });
    }
}

export const getJiraCredentials = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user) {
        console.log(chalk.red('Unauthorized request to get Jira credentials'));
        return res.status(401).json({ apiKey: null, baseUrl: null, email: null });
    }

    const creds = await db().jira_api_keys.findFirst({ where: { user_id: user.id } });
    if (!creds) {
        console.log(chalk.red('No Jira credentials found for user'), chalk.yellow(user.id));
        return res.status(200).json({ apiKey: null, baseUrl: null, email: null });
    }

    const valid = await JiraAdapter.validateCredentials(creds.base_url, creds.jira_user_email, creds.api_token);
    if (!valid) {
        console.log(chalk.red('Invalid Jira credentials found for user'), chalk.yellow(user.id));
        await db().jira_api_keys.delete({ where: { id: creds.id } });
        return res.status(200).json({ apiKey: null, baseUrl: null, email: null });
    }

    res.status(200).json({ apiKey: creds.api_token, baseUrl: creds.base_url, email: creds.jira_user_email });
};

export const deleteJiraCredentials = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { integrationId } = req.body;

    if (!integrationId) {
        return res.status(400).json({ error: 'Integration ID is required' });
    }

    // Verify the integration belongs to the user
    const creds = await db().jira_api_keys.findFirst({
        where: {
            id: integrationId,
            user_id: user.id
        }
    });

    if (!creds) {
        return res.status(404).json({ error: 'Jira integration not found' });
    }

    const adapter = new JiraAdapter({ baseUrl: creds.base_url, email: creds.jira_user_email, apiToken: creds.api_token });
    if (creds.webhook_id) {
        await adapter.tearDownWebhook(creds.webhook_id);
    }

    // Clean up automation inputs/outputs that reference this Jira integration
    await db().automation_inputs.deleteMany({
        where: {
            integration_type: 'JIRA',
            integration_id: creds.id
        }
    });

    await db().automation_outputs.deleteMany({
        where: {
            integration_type: 'JIRA',
            integration_id: creds.id
        }
    });

    await db().jira_api_keys.delete({ where: { id: integrationId } });
    console.log(chalk.green('Deleted Jira credentials for user'), chalk.yellow(user.id));
    res.status(200).json({ message: 'Credentials deleted' });
}

export const indexJiraTicket = async (jiraUserId: string, body: JiraWebhookPayload) => {
    try {
        // Find user by their Jira user email from the webhook
        const jiraIntegration = await db().jira_api_keys.findFirst({
            where: {
                jira_user_email: body.user.emailAddress
            }
        });

        if (!jiraIntegration) {
            console.log(chalk.yellow("No Jira integration found for user email"), body.user.emailAddress);
            return null;
        }

        const userId = jiraIntegration.user_id;
        
        const user = await findUserById(userId);
        if (!user) {
            console.log(chalk.yellow("User not found for ID"), userId);
            return null;
        }

        const ticketManager = await getUserTicketManager(user.id);
        if (!ticketManager) {
            console.log(chalk.yellow("No ticket manager found for user"), user.id);
            return null;
        }

        const ticketId = body.issue.id;
        
        // Get search items for the ticket
        const searchItems = await ticketManager.searchItemsForTicket(ticketId);
        if (searchItems.length === 0) {
            console.log(chalk.yellow("No search items found for ticket"), ticketId);
            return null;
        }

        // Bulk insert the search items
        await search().bulkInsert(searchItems);

        console.log(chalk.green("✅ Indexed Jira ticket"), chalk.yellow(body.issue.key), `(ID: ${ticketId})`);
        
        return true;
    } catch (error) {
        console.error(chalk.red("Error indexing Jira ticket:"), error);
        return null;
    }
}