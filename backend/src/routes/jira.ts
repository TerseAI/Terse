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
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { baseUrl, apiKey, email } = req.body;
    console.log(req.body);
    console.log("Attempting to set Jira credentials", baseUrl, email, apiKey);
    const valid = await JiraAdapter.validateCredentials(baseUrl, email, apiKey);
    if (!valid) {
        return res.status(400).json({ error: 'Invalid Jira credentials' });
    }

    let adapter = new JiraAdapter({ baseUrl: baseUrl, email: email, apiToken: apiKey });

    const configureWebhook = await adapter.configureWebhook();
    if (!configureWebhook) {
        return res.status(400).json({ error: 'Failed to configure webhook' });
    }

    await db().jira_api_keys.create({
        data: {
            user_id: user.id,
            jira_user_email: email,
            base_url: baseUrl,
            api_token: apiKey,
            webhook_id: configureWebhook.webhookId,
        }
    });

    console.log(chalk.green('Stored Jira credentials for user'), chalk.yellow(user.id));
    res.status(200).json({ message: 'Credentials set' });
};

export const getJiraCredentials = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user) {
        console.log(chalk.red('Unauthorized request to get Jira credentials'));
        return res.status(401).json({ apiKey: null, baseUrl: null, email: null });
    }

    const creds = await db().jira_api_keys.findUnique({ where: { user_id: user.id } });
    if (!creds) {
        console.log(chalk.red('No Jira credentials found for user'), chalk.yellow(user.id));
        return res.status(200).json({ apiKey: null, baseUrl: null, email: null });
    }

    const valid = await JiraAdapter.validateCredentials(creds.base_url, creds.jira_user_email, creds.api_token);
    if (!valid) {
        console.log(chalk.red('Invalid Jira credentials found for user'), chalk.yellow(user.id));
        await db().jira_api_keys.delete({ where: { user_id: user.id } });
        return res.status(200).json({ apiKey: null, baseUrl: null, email: null });
    }

    res.status(200).json({ apiKey: creds.api_token, baseUrl: creds.base_url, email: creds.jira_user_email });
};

export const deleteJiraCredentials = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const creds = await db().jira_api_keys.findUnique({ where: { user_id: user.id } });
    if (!creds) {
        return res.status(400).json({ error: 'No Jira credentials found' });
    }

    const adapter = new JiraAdapter({ baseUrl: creds.base_url, email: creds.jira_user_email, apiToken: creds.api_token });
    if (creds.webhook_id) {
        await adapter.tearDownWebhook(creds.webhook_id);
    }

    await db().jira_api_keys.delete({ where: { user_id: user.id } });
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