import { Request, Response } from "express";
import chalk from "chalk";
import crypto from "crypto";
import { LinearWebhookPayload } from "../utility/LinearWebhookPayload";
import { LinearIntegrationManager } from "../integrations/LinearIntegration";
import { settings } from "../config/settings";
import { db } from "../prismaClient";
import { LinearTeam } from "../shared/types";
import { LinearAdapter } from "../ticketing/linear";
import logger from "../logger";


/**
 * Verify Linear webhook signature
 * @param headerSignatureString - The Linear-Signature header value (hex-encoded)
 * @param rawBody - The raw request body as a Buffer
 * @returns true if signature is valid, false otherwise
 */
function verifySignature(headerSignatureString: string | undefined, rawBody: Buffer): boolean {
    if (typeof headerSignatureString !== "string") {
        return false;
    }

    const LINEAR_WEBHOOK_SECRET = settings.linear.signingSecret;
    if (!LINEAR_WEBHOOK_SECRET) {
        logger.error('LINEAR_WEBHOOK_SECRET is not configured');
        return false;
    }

    try {
        const headerSignature = Buffer.from(headerSignatureString, "hex");
        const computedSignature = crypto
            .createHmac("sha256", LINEAR_WEBHOOK_SECRET)
            .update(rawBody)
            .digest();

        return crypto.timingSafeEqual(computedSignature, headerSignature);
    } catch (error) {
        logger.error('Error verifying signature:', { error });
        return false;
    }
}

// OAuth Functions
export const linearOAuthCallback = async (req: Request, res: Response) => {
    const integration = new LinearIntegrationManager();
    await integration.processInstallationCallback(req, res);
};

export const handleLinearWebhook = async (req: Request, res: Response) => {
    try {
        // Get raw body (Buffer from express.raw())
        const rawBody = req.body as Buffer;
        if (!rawBody || !Buffer.isBuffer(rawBody)) {
            logger.error('Missing or invalid raw body');
            return res.sendStatus(400);
        }

        // Verify signature
        const headerSignature = req.get("linear-signature");
        if (!verifySignature(headerSignature, rawBody)) {
            logger.error('Invalid signature');
            return res.sendStatus(401);
        }

        // Parse JSON body
        let body: LinearWebhookPayload;
        try {
            body = JSON.parse(rawBody.toString("utf8")) as LinearWebhookPayload;
        } catch (error) {
            logger.error('Failed to parse JSON body:', { error });
            return res.sendStatus(400);
        }

        // Ack early, avoid spamming the webhook
        res.status(200).json({ received: true });

        // Process webhook event asynchronously
        const integration = new LinearIntegrationManager();
        await integration.processWebhookEvent(body);
    } catch (error) {
        logger.error('Error processing webhook:', { error });
        // Indicate to Linear that there was a server error so the webhook is retried later
        return res.sendStatus(500);
    }
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
        logger.error('Error fetching Linear integrations:', { error });
        res.status(500).json({ error: 'Failed to fetch Linear integrations' });
    }
}

export async function getLinearTeams(req: Request, res: Response) {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const integrationId = req.query.integrationId as string;
    if (!integrationId) {
        return res.status(400).json({ error: "integrationId is required" });
    }

    try {
        const response = await fetchLinearTeams(user.id, integrationId);
        res.status(200).json(response);
    } catch (error: unknown) {
        logger.error('Error fetching Linear teams:', { error });
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch Linear teams';
        res.status(500).json({ error: errorMessage });
    }
}

export async function fetchLinearTeams(userId: string, integrationId: string): Promise<LinearTeam[]> {
    const integration = await db().linear_integrations.findFirst({
        where: {
            id: integrationId,
            user_id: userId,
        },
    });

    if (!integration) {
        throw new Error("Linear integration not found");
    }

    const manager = new LinearIntegrationManager();
    const accessToken = await manager.getAccessToken(integrationId);
    if (!accessToken) {
        throw new Error("Could not get valid access token");
    }

    const adapter = new LinearAdapter(accessToken);
    const teams = await adapter.getTeams();

    return teams.map(team => ({
        id: team.id,
        name: team.name,
        key: team.key,
    }));
}