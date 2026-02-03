import { Request, Response } from "express"

import { cloudScheduler } from "../config/settings"
import { isOAuthIntegrationInstallation } from "../integrations/abstract/Integration"
import { INTEGRATION_REGISTRY } from "../integrations/abstract/IntegrationRegistry"
import logger from "../logger"
import { IntegrationType } from "../shared/Integrations"

/**
 * Validate that the request comes from Google Cloud Scheduler
 * Validates the secret token in the Authorization header
 */
function validateCloudSchedulerRequest(req: Request): boolean {
    const authHeader = req.headers["authorization"]

    // Cloud Scheduler should send the secret token in the Authorization header
    // Format: "Bearer <token>" or just the token value
    if (!authHeader) {
        logger.warn("Missing Authorization header")
        return false
    }

    // Extract token from "Bearer <token>" or just check the header value
    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader

    // Validate against configured secret
    if (token !== cloudScheduler.secret) {
        logger.warn("Invalid cron secret token")
        return false
    }

    return true
}

/**
 * Refresh tokens for all OAuth integrations
 * This endpoint is triggered by Google Cloud Scheduler
 */
export async function refreshAllTokens(req: Request, res: Response) {
    logger.info("Token refresh cron job triggered")

    // Validate request comes from Google Cloud Scheduler
    if (!validateCloudSchedulerRequest(req)) {
        logger.error("Unauthorized: Request did not pass Cloud Scheduler validation")
        return res.status(401).json({ error: "Unauthorized" })
    }

    try {
        const results: {
            integrationType: IntegrationType
            total: number
            refreshed: number
            failed: number
            failures: Array<{ integrationId: string; error: string }>
        }[] = []

        // Process each OAuth integration type
        for (const integrationManager of INTEGRATION_REGISTRY) {
            if (!isOAuthIntegrationInstallation(integrationManager)) {
                continue // Skip non-OAuth integrations
            }

            const integrationType = integrationManager.integrationType
            logger.info(`Processing ${integrationType} integrations...`)

            try {
                // Get all active integration instances using the interface method
                const integrations = await integrationManager.getAllActiveInstances()

                if (integrations.length === 0) {
                    logger.debug(`No ${integrationType} integrations found`)
                    results.push({
                        integrationType,
                        total: 0,
                        refreshed: 0,
                        failed: 0,
                        failures: []
                    })
                    continue
                }

                logger.info(`Found ${integrations.length} ${integrationType} integration(s) to refresh`)

                // Refresh tokens for each integration
                let successCount = 0
                let failureCount = 0
                const failures: Array<{ integrationId: string; error: string }> = []

                for (const integration of integrations) {
                    try {
                        const refreshed = await integrationManager.refreshToken(integration.id)
                        if (refreshed) {
                            successCount++
                        } else {
                            // Token didn't need refreshing (still valid)
                            // This is not a failure, just count it as processed
                        }
                    } catch (error: any) {
                        failureCount++
                        failures.push({
                            integrationId: integration.id,
                            error: error.message || "Unknown error"
                        })
                        logger.error(`Failed to refresh token for ${integrationType} integration ${integration.id}:`, { error })
                    }
                }

                results.push({
                    integrationType,
                    total: integrations.length,
                    refreshed: successCount,
                    failed: failureCount,
                    failures: failures.length > 0 ? failures : []
                })

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
            summary: {
                total: totalIntegrations,
                refreshed: totalRefreshed,
                failed: totalFailed
            },
            results: results
        })
    } catch (error) {
        logger.error("Error in token refresh cron job:", { error })
        return res.status(500).json({
            error: "Internal server error",
            message: error instanceof Error ? error.message : "Unknown error"
        })
    }
}
