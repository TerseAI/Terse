import { Request, Response } from "express"
import { MetaAdsAdAccount, MetaAdsPage } from "terse-types"

import logger from "../../../common/logger"
import { MetaAdsApiError, fetchMetaAdsAdAccounts, fetchMetaAdsPages } from "../../../integrations/metaAds/apiClient"
import { MetaAdsIntegrationManager } from "../../../integrations/metaAds/integration"

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
    await respondWithConnectionResources(req, res, "ad accounts", async accessToken => {
        const adAccounts = await fetchMetaAdsAdAccounts(accessToken)
        return adAccounts.map(
            (account): MetaAdsAdAccount => ({
                id: account.id,
                accountId: account.account_id,
                name: account.name,
                currency: account.currency,
                accountStatus: account.account_status
            })
        )
    })
}

export async function getMetaAdsPages(req: Request, res: Response) {
    await respondWithConnectionResources(req, res, "Pages", async accessToken => {
        const pages = await fetchMetaAdsPages(accessToken)
        return pages.map((page): MetaAdsPage => ({ id: page.id, name: page.name, category: page.category }))
    })
}

export async function metaAdsOAuthCallback(req: Request, res: Response) {
    const manager = new MetaAdsIntegrationManager()
    await manager.processInstallationCallback(req, res)
}

async function respondWithConnectionResources<T>(req: Request, res: Response, what: string, fetchResources: (accessToken: string) => Promise<T[]>) {
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
        const integration = await manager.getInstance(integrationId, req.session.user.organizationId)
        if (!integration) {
            res.status(404).json({ error: "Meta Ads integration not found" })
            return
        }

        const accessToken = await manager.getAccessToken(integrationId)
        if (!accessToken) {
            res.status(404).json({ error: "Meta Ads integration not found or not connected" })
            return
        }

        res.status(200).json(await fetchResources(accessToken))
    } catch (error) {
        logger.error(`Error fetching Meta Ads ${what}`, { error, integrationId })
        const status = error instanceof MetaAdsApiError && error.status === 401 ? 401 : 500
        res.status(status).json({ error: `Failed to fetch Meta Ads ${what}` })
    }
}
