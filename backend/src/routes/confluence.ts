import { Request, Response } from "express"

import { AtlassianClient, fetchConfluenceResources } from "../integrations/AtlassianClient"
import logger from "../logger"

// MARK: - Route Handlers

export async function getConfluenceIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    try {
        const manager = new AtlassianClient()
        const integrations = await manager.getInstancesForOrganization(req.session.user.organizationId)
        res.status(200).json(integrations)
    } catch (error) {
        logger.error("Error fetching Confluence integrations:", { error })
        res.status(500).json({ error: "Failed to fetch Confluence integrations" })
    }
}

// fetchConfluenceResources is now exported from AtlassianClient to avoid circular dependencies
export { fetchConfluenceResources }

export async function getConfluenceResources(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) {
        return res.status(401).json({ success: false, error: "Unauthorized" })
    }

    const integrationId = req.query.integrationId as string
    if (!integrationId) {
        return res.status(400).json({ success: false, error: "integrationId is required" })
    }

    const search = (req.query.search as string) || ""

    try {
        if (!user.organizationId) {
            return res.status(400).json({ success: false, error: "Organization context is required" })
        }
        const response = await fetchConfluenceResources(user.organizationId, integrationId, search)
        return res.status(200).json(response)
    } catch (error: any) {
        logger.error("Error searching Confluence resources:", { error })
        return res.status(500).json({
            success: false,
            error: error.message || "Failed to search Confluence resources"
        })
    }
}
