import { Request, Response } from "express"
import { z } from "zod"

import logger from "../../../common/logger"
import { parseFormSubmissionFromRequest } from "../../../integrations/abstract/Integration"
import { ResendIntegrationManager, fetchResendTemplates } from "../../../integrations/resend/integration"

export async function getResendIntegrations(req: Request, res: Response) {
    if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" })
    try {
        res.json(await new ResendIntegrationManager().getInstancesForOrganization(req.session.user.organizationId))
    } catch (error) {
        logger.error("Failed to fetch Resend integrations", { error })
        res.status(500).json({ error: "Failed to fetch Resend integrations" })
    }
}

export async function createOrUpdateResendIntegration(req: Request, res: Response) {
    const input = parseFormSubmissionFromRequest(req)
    if (!input) return res.status(401).json({ error: "Unauthorized" })
    const result = await new ResendIntegrationManager().processFormSubmission(input)
    res.status(result.statusCode ?? (result.success ? 200 : 500)).json(result.success ? (result.data ?? { success: true }) : { error: result.error })
}

const templatesQuerySchema = z.object({ integrationId: z.string() })

export async function getResendTemplates(req: Request, res: Response) {
    if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" })
    const parsed = templatesQuerySchema.safeParse(req.query)
    if (!parsed.success) return res.status(400).json({ error: "integrationId is required" })
    try {
        res.json({ templates: await fetchResendTemplates(req.session.user.organizationId, parsed.data.integrationId) })
    } catch (error) {
        logger.error("Failed to fetch Resend templates", { error })
        res.status(500).json({ error: "Failed to fetch Resend templates" })
    }
}
