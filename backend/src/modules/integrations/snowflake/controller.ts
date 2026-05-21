import { Request, Response } from "express"

import logger from "../../../common/logger"
import { parseFormSubmissionFromRequest } from "../../../integrations/abstract/Integration"
import { SnowflakeIntegrationManager } from "../../../integrations/snowflake/integration"

export async function getSnowflakeIntegrations(req: Request, res: Response) {
    if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" })
    try {
        const manager = new SnowflakeIntegrationManager()
        const integrations = await manager.getInstancesForOrganization(req.session.user.organizationId)
        res.status(200).json(integrations)
    } catch (error) {
        logger.error("Error fetching Snowflake integrations:", { error })
        res.status(500).json({ error: "Failed to fetch Snowflake integrations" })
    }
}

export async function createOrUpdateSnowflakeIntegration(req: Request, res: Response) {
    if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" })
    try {
        const input = parseFormSubmissionFromRequest(req)
        if (!input) return res.status(401).json({ error: "Unauthorized" })

        const manager = new SnowflakeIntegrationManager()
        const result = await manager.processFormSubmission(input)
        if (!result.success) return res.status(result.statusCode ?? 400).json(result)
        res.status(result.statusCode ?? 200).json(result)
    } catch (error) {
        logger.error("Error creating/updating Snowflake integration:", { error })
        res.status(500).json({ error: "Failed to process integration" })
    }
}
