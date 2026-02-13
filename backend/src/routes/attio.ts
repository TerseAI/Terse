import { Request, Response } from "express"

import { AttioIntegrationManager } from "../integrations/AttioIntegration"
import logger from "../logger"

export async function getAttioIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    try {
        const manager = new AttioIntegrationManager()
        const integrations = await manager.getInstancesForOrganization(req.session.user.organizationId)
        res.status(200).json(integrations)
    } catch (error) {
        logger.error("Error fetching Attio integrations:", { error })
        res.status(500).json({ error: "Failed to fetch Attio integrations" })
    }
}

export const attioOAuthCallback = async (req: Request, res: Response) => {
    const integration = new AttioIntegrationManager()
    await integration.processInstallationCallback(req, res)
}
