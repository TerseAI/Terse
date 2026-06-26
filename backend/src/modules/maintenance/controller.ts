import { IntegrationType } from "terse-types/Integrations"

import logger from "../../common/logger"
import { GoogleSecretManagerClient } from "../../ee/services/secretManager/GoogleSecretManagerClient"
import { isOAuthIntegrationInstallation } from "../../integrations/abstract/Integration"
import { getIntegrationRegistry } from "../../integrations/abstract/IntegrationRegistry"
import { settings } from "../../settings"

interface TokenRefreshSummary {
    summary: { total: number; refreshed: number; failed: number }
    results: { integrationType: IntegrationType; total: number; refreshed: number; failed: number; failures: Array<{ integrationId: string; error: string }> }[]
}

/** Core logic for the token-refresh cron. Callable from the HTTP route and the BullMQ worker. */
export async function runTokenRefresh(): Promise<TokenRefreshSummary> {
    const results: TokenRefreshSummary["results"] = []

    for (const integrationManager of getIntegrationRegistry()) {
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

/**
 * Core logic for the clear-old-secret-versions cron. Returns null when skipped (gcp not configured).
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
