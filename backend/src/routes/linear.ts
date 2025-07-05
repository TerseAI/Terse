import { Request, Response } from "express";
import { db } from "../prismaClient";
import chalk from "chalk";
import axios from "axios";
import { LinearAdapter } from "src/ticketing/linear";
import { findUserById, getUserTicketManager } from "src/types/user";

export const setLinearApiKey = async (req: Request, res: Response) => {
    let user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { apiKey } = req.body;
    console.log(chalk.blue("🔑 Adding Linear API key for user"), chalk.yellow(user.id));

    let adapter = new LinearAdapter(apiKey);

    // Validate the API key before storing
    const isValid = await LinearAdapter.validateKey(apiKey);
    if (!isValid) {
        return res.status(400).json({ error: 'Invalid Linear API key' });
    }

    const configureWebhook = await adapter.configureWebhook();
    if (!configureWebhook) {
        return res.status(400).json({ error: 'Failed to configure webhook' });
    }

    await db().linear_api_keys.create({
        data: {
            user_id: user.id,
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

    res.status(200).json({ apiKey: linearApiKey.api_key });
}

export const indexLinearTicket = async (userId: string, body: any) => {
    let user = await findUserById(userId);
    if (!user) {
        return null;
    }

    const ticketManager = await getUserTicketManager(user.id);
    if (!ticketManager) {
        return null;
    }

    return await ticketManager.indexTicket(body.id);
}