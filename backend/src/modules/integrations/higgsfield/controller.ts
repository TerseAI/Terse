import { Request, Response } from "express"

import logger from "../../../common/logger"
import { parseFormSubmissionFromRequest } from "../../../integrations/abstract/Integration"
import { HiggsfieldIntegrationManager } from "../../../integrations/higgsfield/integration"

export async function getHiggsfieldIntegrations(req: Request, res: Response) {
    if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" })
    try {
        res.json(await new HiggsfieldIntegrationManager().getInstancesForOrganization(req.session.user.organizationId))
    } catch (error) {
        logger.error("Failed to fetch Higgsfield integrations", { error })
        res.status(500).json({ error: "Failed to fetch Higgsfield integrations" })
    }
}

export async function createOrUpdateHiggsfieldIntegration(req: Request, res: Response) {
    const input = parseFormSubmissionFromRequest(req)
    if (!input) return res.status(401).json({ error: "Unauthorized" })
    const result = await new HiggsfieldIntegrationManager().processFormSubmission(input)
    res.status(result.statusCode ?? (result.success ? 200 : 500)).json(result.success ? (result.data ?? { success: true }) : { error: result.error })
}
