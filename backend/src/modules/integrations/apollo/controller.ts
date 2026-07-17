import { Request, Response } from "express"

import logger from "../../../common/logger"
import { parseFormSubmissionFromRequest } from "../../../integrations/abstract/Integration"
import { ApolloIntegrationManager } from "../../../integrations/apollo/integration"

export async function getApolloIntegrations(req: Request, res: Response) {
    if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" })
    try {
        res.json(await new ApolloIntegrationManager().getInstancesForOrganization(req.session.user.organizationId))
    } catch (error) {
        logger.error("Failed to fetch Apollo integrations", { error })
        res.status(500).json({ error: "Failed to fetch Apollo integrations" })
    }
}

export async function createOrUpdateApolloIntegration(req: Request, res: Response) {
    const input = parseFormSubmissionFromRequest(req)
    if (!input) return res.status(401).json({ error: "Unauthorized" })
    const result = await new ApolloIntegrationManager().processFormSubmission(input)
    res.status(result.statusCode ?? (result.success ? 200 : 500)).json(result.success ? (result.data ?? { success: true }) : { error: result.error })
}
