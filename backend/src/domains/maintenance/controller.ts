import { Request, Response } from "express"
import { IntegrationType } from "terse-types/Integrations"
import { z } from "zod"

import logger from "../../common/logger"
import { isOAuthIntegrationInstallation } from "../../integrations/abstract/Integration"
import { INTEGRATION_REGISTRY } from "../../integrations/abstract/IntegrationRegistry"
import { SecretManagerClient } from "../../utility/secretManagerClient"

const clearOldSecretVersionsRequestSchema = z.object({
    dryRun: z.preprocess(value => {
        return value !== undefined && typeof value === "string" && value.trim().toLowerCase() === "true"
    }, z.boolean())
})

export async function refreshAllTokens(req: Request, res: Response) {
    logger.info("Token refresh cron job triggered")

    try {
        const results: { integrationType: IntegrationType; total: number; refreshed: number; failed: number; failures: Array<{ integrationId: string; error: string }> }[] = []

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

        const totalIntegrations = results.reduce((sum, r) => sum + r.total, 0)
        const totalRefreshed = results.reduce((sum, r) => sum + r.refreshed, 0)
        const totalFailed = results.reduce((sum, r) => sum + r.failed, 0)

        logger.info(`Token refresh completed: ${totalRefreshed} refreshed, ${totalFailed} failed across ${totalIntegrations} total integrations`)

        return res.json({
            message: "Token refresh completed",
            summary: { total: totalIntegrations, refreshed: totalRefreshed, failed: totalFailed },
            results
        })
    } catch (error) {
        logger.error("Error in token refresh cron job:", { error })
        return res.status(500).json({ error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" })
    }
}

export async function clearOldSecretVersions(req: Request, res: Response) {
    logger.info("Clearing old secret versions cron job triggered")

    const parsedInput = clearOldSecretVersionsRequestSchema.safeParse({
        dryRun: req.query.dryRun ?? req.body?.dryRun
    })

    if (!parsedInput.success) {
        return res.status(400).json({ error: "Invalid request", details: parsedInput.error.flatten() })
    }

    const secretService = SecretManagerClient.getInstance()

    try {
        const report = await secretService.clearOldSecretVersions(parsedInput.data)

        logger.info("Clear old secret versions completed", {
            dryRun: report.dryRun,
            numberOfSecretsCleared: report.numberOfSecretsCleared,
            numberOfVersionsCleared: report.numberOfVersionsCleared,
            numberOfErrors: report.numberOfErrors
        })

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
