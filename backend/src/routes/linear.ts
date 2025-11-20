import { Request, Response } from "express";
import { db } from "../prismaClient";
import chalk from "chalk";
import { LinearAdapter } from "../ticketing/linear";
import { findUserById, getUserTicketManager } from "../types/user";
import { LinearWebhookPayload } from "../utility/LinearWebhookPayload";
import { search } from "../searchClient";
import { LinearIntegrationManager } from "src/integrations/LinearIntegration";
import { InputConfigType } from "@prisma/client";


// OAuth Functions
export const linearOAuthCallback = async (req: Request, res: Response) => {
    const integration = new LinearIntegrationManager();
    await integration.processInstallationCallback(req, res);
};

export const handleLinearWebhook = async (req: Request, res: Response) => {
    // ack early, avoid spamming the webhook
    res.status(200).json({ received: true });

    const integration = new LinearIntegrationManager();
};

export async function getLinearIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const manager = new LinearIntegrationManager();
        const integrations = await manager.getInstancesForUser(req.session.user.id);
        res.status(200).json(integrations);
    } catch (error) {
        console.error('Error fetching Linear integrations:', error);
        res.status(500).json({ error: 'Failed to fetch Linear integrations' });
    }
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