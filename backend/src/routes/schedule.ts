import { Request, Response } from "express";
import { cloudScheduler } from "../config/settings";
import { CronJobIntegrationManager } from "../integrations/CronJobIntegration";
import logger from "../logger";

export async function handleScheduleWebhook(req: Request, res: Response) {
    const { inputId } = req.params;

    logger.info("⏰ Schedule webhook received", { inputId });

    // Verify the request is from Cloud Scheduler using a shared secret
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
        logger.warn("⚠️  Unauthorized schedule webhook request: Missing Authorization header", { inputId });
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    // Extract token from "Bearer <token>" or just check the header value
    const token = authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : authHeader;

    // Validate against configured secret
    if (token !== cloudScheduler.secret) {
        logger.warn("⚠️  Unauthorized schedule webhook request: Invalid token", { inputId });
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    if (!inputId) {
        logger.warn("⚠️  Schedule webhook missing inputId");
        res.status(400).json({ error: "Missing inputId" });
        return;
    }

    // Acknowledge immediately
    res.status(200).json({ received: true });

    // Process asynchronously
    const cronJobManager = new CronJobIntegrationManager();
    cronJobManager.processWebhookEvent({ inputId }).catch((error) => {
        logger.error("❌ Error processing schedule webhook", { error, inputId });
    });
}
