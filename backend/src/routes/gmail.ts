import { gmail as createGmailClient } from "@googleapis/gmail"
import { InputConfigType, OutputConfigType } from "@prisma/client"
import { Request, Response } from "express"
import { OAuth2Client } from "google-auth-library"
import { IntegrationType } from "terse-types/Integrations"

import { gmail as gmailConfig, settings } from "../config/settings"
import { GmailIntegrationManager, GmailWebhookEvent, getOAuth2Client } from "../integrations/GmailIntegration"
import logger from "../logger"
import { db } from "../prismaClient"
import { SecretService } from "../services/SecretService"
import { readBearerToken } from "../utility/authDispatch"

const pubsubOidcClient = new OAuth2Client()

export async function getGmailIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    try {
        const manager = new GmailIntegrationManager()
        const integrations = await manager.getInstancesForOrganization(req.session.user.organizationId)
        res.status(200).json(integrations)
    } catch (error) {
        logger.error("Error fetching Gmail integrations:", { error })
        res.status(500).json({ error: "Failed to fetch Gmail integrations" })
    }
}

/**
 * Handle Gmail OAuth callback
 */
export async function gmailCallback(req: Request, res: Response) {
    const integration = new GmailIntegrationManager()
    await integration.processInstallationCallback(req, res)
}

/**
 * Disable Gmail integration (set is_active to false)
 */
export async function deleteGmailIntegration(req: Request, res: Response) {
    if (!req.session?.user) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    try {
        const organizationId = req.session.user.organizationId
        if (!organizationId) {
            return res.status(400).json({ error: "Organization context is required" })
        }
        // Get the active integration (org-level: any org member can manage)
        const integration = await db().gmail_integrations.findFirst({
            where: {
                organization_id: organizationId,
                is_active: true
            }
        })

        if (!integration) {
            return res.status(404).json({ error: "No active Gmail integration found" })
        }

        const secretService = SecretService.getInstance()
        const secrets = await secretService.getSecrets({
            type: "integration",
            secret: { integrationType: IntegrationType.GMAIL, recordId: integration.id }
        })
        const { accessToken, refreshToken } = secrets

        // Set up OAuth client with stored credentials
        const oauth2Client = getOAuth2Client()
        oauth2Client.setCredentials({
            access_token: accessToken,
            ...(refreshToken ? { refresh_token: refreshToken } : {}),
            expiry_date: integration.token_expiry.getTime()
        })

        try {
            // Stop the Gmail watch
            const gmail = createGmailClient({ version: "v1", auth: oauth2Client })
            await gmail.users.stop({ userId: "me" })
            logger.info(`Gmail watch stopped for ${integration.email}`)
        } catch (stopError) {
            // Log but don't fail the deactivation if watch stop fails
            // (watch might already be expired or stopped)
            logger.warn("Error stopping Gmail watch:", { error: stopError })
        }

        // Clean up channel inputs/outputs that reference this Gmail integration
        await db().automation_inputs.deleteMany({
            where: {
                config_type: InputConfigType.GMAIL,
                integration_id: integration.id
            }
        })

        // Clean up channel outputs that reference this Gmail integration
        await db().automation_outputs.deleteMany({
            where: {
                config_type: { in: [OutputConfigType.GMAIL, OutputConfigType.GMAIL_DRAFT] },
                integration_id: integration.id
            }
        })

        // Set is_active to false instead of deleting
        await db().gmail_integrations.update({
            where: { id: integration.id },
            data: { is_active: false }
        })

        logger.info(`Gmail integration deactivated for user ${req.session.user.id}`)
        res.json({ message: "Gmail integration disabled successfully" })
    } catch (error) {
        logger.error("Error disabling Gmail integration:", { error })
        res.status(500).json({ error: "Failed to disable Gmail integration" })
    }
}

export async function handleGmailWebhook(req: Request, res: Response) {
    const verified = await verifyPubsubOidc(req)
    if (!verified) {
        res.status(401).send("Unauthorized")
        return
    }

    logger.info("Gmail webhook received", { body: req.body })

    // Extract and validate webhook data
    const webhookData = extractWebhookData(req)
    if (!webhookData) {
        return res.status(400).send("Invalid message format")
    }

    // Immediately acknowledge to Gmail to prevent duplicate deliveries
    res.status(200).send("OK")

    const gmailIntegration = new GmailIntegrationManager()
    try {
        await gmailIntegration.processWebhookEvent({
            emailAddress: webhookData.emailAddress,
            historyId: webhookData.historyId
        })
    } catch (error) {
        logger.error("Error processing Gmail webhook:", { error })
    }
}

async function verifyPubsubOidc(req: Request): Promise<boolean> {
    const audience = gmailConfig.pubsubAudience
    if (!audience) {
        if (settings.nodeEnv === "production") {
            logger.error("[gmail-webhook] GMAIL_PUBSUB_AUDIENCE not configured in production — refusing webhook delivery")
            return false
        }
        logger.warn("[gmail-webhook] GMAIL_PUBSUB_AUDIENCE not configured — accepting delivery without OIDC verification (dev only)")
        return true
    }

    const bearer = readBearerToken(req.headers.authorization)
    if (!bearer) {
        logger.warn("[gmail-webhook] Missing Pub/Sub OIDC bearer token")
        return false
    }

    try {
        const ticket = await pubsubOidcClient.verifyIdToken({ idToken: bearer, audience })
        const payload = ticket.getPayload()
        if (!payload) {
            logger.warn("[gmail-webhook] OIDC token verified but payload was empty")
            return false
        }
        if (payload.email_verified !== true) {
            logger.warn("[gmail-webhook] OIDC token email_verified is not true", { email: payload.email })
            return false
        }
        const expectedEmail = gmailConfig.pubsubServiceAccountEmail
        if (expectedEmail && payload.email !== expectedEmail) {
            logger.warn("[gmail-webhook] OIDC token email does not match configured service account", { email: payload.email })
            return false
        }
        return true
    } catch (error) {
        logger.warn("[gmail-webhook] OIDC token verification failed", { error: error instanceof Error ? error.message : error })
        return false
    }
}

/**
 * Extract and validate webhook data from the request
 */
function extractWebhookData(req: Request): { emailAddress: string; historyId: number } | null {
    const { message } = req.body

    if (!message || !message.data) {
        return null
    }

    try {
        const decoded: GmailWebhookEvent = JSON.parse(Buffer.from(message.data, "base64").toString())

        return {
            emailAddress: decoded.emailAddress,
            historyId: decoded.historyId
        }
    } catch (error) {
        logger.error("Error decoding webhook data:", { error })
        return null
    }
}
