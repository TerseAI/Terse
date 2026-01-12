import { Request, Response } from "express";
import { cloudScheduler } from "../config/settings";
import { CronJobIntegrationManager } from "../integrations/CronJobIntegration";
import logger from "../logger";
import { Session } from "../server";

export interface ManualTriggerRequest {
    context?: string;
}

export async function handleManualTrigger(req: Request, res: Response) {
    const { inputId } = req.params;
    const { context } = req.body as ManualTriggerRequest;
    const session = req.session as Session;

    logger.info("🖱️ Manual trigger received", { inputId, userId: session.user.id, hasContext: !!context });

    if (!inputId) {
        logger.warn("⚠️  Manual trigger missing inputId");
        res.status(400).json({ error: "Missing inputId" });
        return;
    }

    // Acknowledge immediately
    res.status(200).json({ received: true, message: "Manual trigger initiated" });

    // Process asynchronously
    const cronJobManager = new CronJobIntegrationManager();
    cronJobManager.processWebhookEvent({
        inputId,
        isManualTrigger: true,
        manualContext: context,
    }).catch((error) => {
        logger.error("❌ Error processing manual trigger", { error, inputId });
    });
}

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
