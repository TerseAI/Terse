import { Request, Response } from "express"

import logger from "../logger"
import { AgentTemplate } from "../shared/types"
import { validateTemplates } from "../templates/AgentTemplateSchema"
import templates from "../templates/templates.json" with { type: "json" }

// Validate templates at module load time - this will throw and prevent server startup if invalid
try {
    validateTemplates(templates)
    logger.info(`✅ Successfully validated ${templates.length} template(s)`)
} catch (error) {
    logger.error("❌ Template validation failed at startup", { error })
    // Re-throw to prevent server from starting with invalid templates
    throw error
}

export async function getTemplates(req: Request, res: Response): Promise<void> {
    try {
        // Templates are already validated at startup, but validate again for safety
        validateTemplates(templates)
        res.status(200).json(templates as AgentTemplate[])
    } catch (error) {
        logger.error("Error fetching templates", { error })
        res.status(500).json({ error: "Failed to fetch templates" })
    }
}
