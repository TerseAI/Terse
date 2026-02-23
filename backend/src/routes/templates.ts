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

type PublicTemplate = Pick<AgentTemplate, "id" | "name" | "description" | "category" | "chatPrompt"> & {
    triggers: Array<{
        config: {
            configType: AgentTemplate["triggers"][number]["config"]["configType"]
            integrationType: AgentTemplate["triggers"][number]["config"]["integrationType"]
        }
    }>
    outputs: Array<{
        config: {
            configType: AgentTemplate["outputs"][number]["config"]["configType"]
            integrationType: AgentTemplate["outputs"][number]["config"]["integrationType"]
        }
    }>
}

export async function getPublicTemplates(req: Request, res: Response): Promise<void> {
    try {
        validateTemplates(templates)

        const publicTemplates: PublicTemplate[] = (templates as AgentTemplate[]).map(template => ({
            id: template.id,
            name: template.name,
            description: template.description,
            category: template.category,
            chatPrompt: template.chatPrompt,
            triggers: template.triggers.map(trigger => ({
                config: {
                    configType: trigger.config.configType,
                    integrationType: trigger.config.integrationType
                }
            })),
            outputs: template.outputs.map(output => ({
                config: {
                    configType: output.config.configType,
                    integrationType: output.config.integrationType
                }
            }))
        }))

        res.status(200).json(publicTemplates)
    } catch (error) {
        logger.error("Error fetching public templates", { error })
        res.status(500).json({ error: "Failed to fetch templates" })
    }
}
