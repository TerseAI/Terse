import { Request, Response } from "express"

import logger from "../../../common/logger"
import { getSearchConsoleClientForOrganization, listSearchConsoleSites } from "../../../integrations/googlesearchconsole/apiClient"
import { GoogleSearchConsoleIntegrationManager } from "../../../integrations/googlesearchconsole/integration"

export async function getGoogleSearchConsoleIntegrations(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    try {
        const manager = new GoogleSearchConsoleIntegrationManager()
        const integrations = await manager.getInstancesForOrganization(user.organizationId)
        res.status(200).json(integrations)
    } catch (error) {
        logger.error("Error fetching Google Search Console integrations:", { error })
        res.status(500).json({ error: "Failed to fetch Google Search Console integrations" })
    }
}

export async function googleSearchConsoleCallback(req: Request, res: Response) {
    const manager = new GoogleSearchConsoleIntegrationManager()
    await manager.processInstallationCallback(req, res)
}

export async function getGoogleSearchConsoleSites(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    const integrationId = req.query.integrationId
    if (typeof integrationId !== "string" || !integrationId) {
        return res.status(400).json({ error: "integrationId is required" })
    }

    try {
        const client = await getSearchConsoleClientForOrganization(integrationId, user.organizationId)
        const sites = await listSearchConsoleSites(client)
        res.status(200).json({ sites })
    } catch (error) {
        logger.error("Error fetching Google Search Console sites:", { error, integrationId })
        res.status(500).json({ error: "Failed to fetch Google Search Console properties" })
    }
}
