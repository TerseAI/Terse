import { Request, Response } from "express"
import { IntegrationType } from "terse-types/Integrations"
import { z } from "zod"

import logger from "../../common/logger"
import { GoogleSecretManagerClient } from "../../ee/services/secretManager/GoogleSecretManagerClient"
import { isOAuthIntegrationInstallation } from "../../integrations/abstract/Integration"
import { INTEGRATION_REGISTRY } from "../../integrations/abstract/IntegrationRegistry"
import { settings } from "../../settings"

const clearOldSecretVersionsRequestSchema = z.object({
    dryRun: z.preprocess(value => {
        return value !== undefined && typeof value === "string" && value.trim().toLowerCase() === "true"
    }, z.boolean())
})

interface TokenRefreshSummary {
    summary: { total: number; refreshed: number; failed: number }
    results: { integrationType: IntegrationType; total: number; refreshed: number; failed: number; failures: Array<{ integrationId: string; error: string }> }[]
}

/** Core logic for the token-refresh cron. Callable from the HTTP route and the BullMQ worker. */
export async function runTokenRefresh(): Promise<TokenRefreshSummary> {
    const results: TokenRefreshSummary["results"] = []

    for (const integrationManager of INTEGRATION_REGISTRY) {
        if (!isOAuthIntegrationInstallation(integrationManager)) continue

        const integrationType = integrationManager.integrationType
        logger.info(`Processing ${integrationType} integrations...`)

        try {
            const integrations = await integrationManager.getAllActiveInstances()

            if (integrations.length === 0) {
                logger.debug(`No ${integrationType} integrations found`)
                results.push({ integrationType, total: 0, refreshed: 0, failed: 0, failures: [] })
                continue
            }

            logger.info(`Found ${integrations.length} ${integrationType} integration(s) to refresh`)

            let successCount = 0
            let failureCount = 0
            const failures: Array<{ integrationId: string; error: string }> = []

            for (const integration of integrations) {
                try {
                    const refreshed = await integrationManager.refreshToken(integration.id)
                    if (refreshed) {
                        successCount++
                    }
                } catch (error: any) {
                    failureCount++
                    failures.push({ integrationId: integration.id, error: error.message || "Unknown error" })
                    logger.error(`Failed to refresh token for ${integrationType} integration ${integration.id}:`, { error })
                }
            }

            results.push({ integrationType, total: integrations.length, refreshed: successCount, failed: failureCount, failures: failures.length > 0 ? failures : [] })
            logger.info(`${integrationType} token refresh completed: ${successCount} refreshed, ${failureCount} failed`)
        } catch (error) {
            logger.error(`Error processing ${integrationType} integrations:`, { error })
            results.push({
                integrationType,
                total: 0,
                refreshed: 0,
                failed: 0,
                failures: [{ integrationId: "unknown", error: error instanceof Error ? error.message : "Unknown error" }]
            })
        }
    }

    const total = results.reduce((sum, r) => sum + r.total, 0)
    const refreshed = results.reduce((sum, r) => sum + r.refreshed, 0)
    const failed = results.reduce((sum, r) => sum + r.failed, 0)

    logger.info(`Token refresh completed: ${refreshed} refreshed, ${failed} failed across ${total} total integrations`)
    return { summary: { total, refreshed, failed }, results }
}

export async function refreshAllTokens(req: Request, res: Response) {
    logger.info("Token refresh cron job triggered")

    try {
        const { summary, results } = await runTokenRefresh()
        return res.json({ message: "Token refresh completed", summary, results })
    } catch (error) {
        logger.error("Error in token refresh cron job:", { error })
        return res.status(500).json({ error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" })
    }
}

/**
 * Core logic for the clear-old-secret-versions cron. Callable from the HTTP route and the worker.
 * Returns null when skipped (gcp not configured).
 */
export async function runClearOldSecretVersions(opts: { dryRun: boolean }): Promise<Awaited<ReturnType<GoogleSecretManagerClient["clearOldSecretVersions"]>> | null> {
    if (!settings.gcp) {
        logger.info("[ClearOldSecretVersions] Skipping: gcp not configured (self-host has no per-version concept)")
        return null
    }

    const report = await new GoogleSecretManagerClient().clearOldSecretVersions(opts)
    logger.info("Clear old secret versions completed", {
        dryRun: report.dryRun,
        numberOfSecretsCleared: report.numberOfSecretsCleared,
        numberOfVersionsCleared: report.numberOfVersionsCleared,
        numberOfErrors: report.numberOfErrors
    })
    return report
}

export async function clearOldSecretVersions(req: Request, res: Response) {
    logger.info("Clearing old secret versions cron job triggered")

    const parsedInput = clearOldSecretVersionsRequestSchema.safeParse({
        dryRun: req.query.dryRun ?? req.body?.dryRun
    })

    if (!parsedInput.success) {
        return res.status(400).json({ error: "Invalid request", details: parsedInput.error.flatten() })
    }

    try {
        const report = await runClearOldSecretVersions(parsedInput.data)
        if (!report) {
            return res.status(200).json({ skipped: true, reason: "gcp_not_configured" })
        }

        return res.json({
            message: report.dryRun ? "Dry run for clearing old secret versions completed" : "Clear old secret versions completed",
            summary: {
                dryRun: report.dryRun,
                secretsCleared: report.numberOfSecretsCleared,
                versionsCleared: report.numberOfVersionsCleared,
                errors: report.numberOfErrors
            },
            plannedDestructions: report.plannedDestructions,
            errors: report.errors
        })
    } catch (error) {
        logger.error("Error in clear old secret versions cron job:", { error })
        return res.status(500).json({ error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" })
    }
}
