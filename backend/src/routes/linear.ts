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
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { apiKey } = req.body;
    console.log(chalk.blue("🔑 Adding Linear API key for user"), chalk.yellow(user.id));

    // Validate the API key before storing
    const isValid = await LinearAdapter.validateKey(apiKey);
    if (!isValid) {
        return res.status(400).json({ error: 'Invalid Linear API key' });
    }

    let adapter = new LinearAdapter(apiKey);

    const configureWebhook = await adapter.configureWebhook();
    if (!configureWebhook) {
        return res.status(400).json({ error: 'Failed to configure webhook' });
    }

    let linearUser = await adapter.me();
    if (!linearUser) {
        return res.status(400).json({ error: 'Failed to get Linear user' });
    }

    await db().linear_api_keys.create({
        data: {
            user_id: user.id,
            linear_user_id: linearUser.id,
            api_key: apiKey,
            webhook_id: configureWebhook.webhookId,
            webhook_secret: configureWebhook.webhookSecret
        }
    });

    res.status(200).json({ message: 'API key set' });
}

export const getLinearApiKey = async (req: Request, res: Response) => {
    let user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const linearApiKey = await db().linear_api_keys.findUnique({
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
                user_id: user.id
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

    // Need to tear down webhook
    const linearApiKey = await db().linear_api_keys.findUnique({
        where: {
            user_id: user.id
        }
    });

    if (linearApiKey) {
        const adapter = new LinearAdapter(linearApiKey.api_key);
        await adapter.tearDownWebhook(linearApiKey.webhook_id);
    }

    await db().linear_api_keys.delete({ where: { user_id: user.id } });
    console.log(chalk.green('Deleted Linear credentials for user'), chalk.yellow(user.id));
    
    res.status(200).json({ message: 'Credentials deleted' });
}