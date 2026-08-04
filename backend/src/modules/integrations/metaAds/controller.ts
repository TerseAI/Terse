import { Request, Response } from "express"

import logger from "../../../common/logger"
import { MetaAdsIntegrationManager } from "../../../integrations/metaAds/integration"
import { MetaAdsApiError, fetchMetaAdsAdAccounts } from "../../../outputs/metaAds/tools/metaAdsClient"

export async function getMetaAdsIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    try {
        const manager = new MetaAdsIntegrationManager()
        const integrations = await manager.getInstancesForOrganization(req.session.user.organizationId)
        res.status(200).json(integrations)
    } catch (error) {
        logger.error("Error fetching Meta Ads integrations:", { error })
        res.status(500).json({ error: "Failed to fetch Meta Ads integrations" })
    }
}

export async function getMetaAdsAdAccounts(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const { integrationId } = req.params
    if (!integrationId) {
        res.status(400).json({ error: "Missing integrationId parameter" })
        return
    }

    try {
        const manager = new MetaAdsIntegrationManager()
        const orgIntegrations = await manager.getInstancesForOrganization(req.session.user.organizationId)
        if (!orgIntegrations.some(i => i.id === integrationId)) {
            res.status(404).json({ error: "Meta Ads integration not found" })
            return
        }

        const accessToken = await manager.getAccessToken(integrationId)
        if (!accessToken) {
            res.status(404).json({ error: "Meta Ads integration not found or not connected" })
            return
        }

        const adAccounts = await fetchMetaAdsAdAccounts(accessToken)
        res.status(200).json(
            adAccounts.map(account => ({
                id: account.id,
                accountId: account.account_id,
                name: account.name,
                currency: account.currency,
                accountStatus: account.account_status
            }))
        )
    } catch (error) {
        logger.error("Error fetching Meta Ads ad accounts", { error, integrationId })
        const status = error instanceof MetaAdsApiError && error.status === 401 ? 401 : 500
        res.status(status).json({ error: "Failed to fetch Meta Ads ad accounts" })
    }
}

export async function metaAdsOAuthCallback(req: Request, res: Response) {
    const manager = new MetaAdsIntegrationManager()
    await manager.processInstallationCallback(req, res)
}
