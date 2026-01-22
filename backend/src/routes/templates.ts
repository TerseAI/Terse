import { Request, Response } from "express";
import templates from "../templates/templates.json" with { type: "json" };
import logger from "../logger";
import { AgentTemplate } from "../shared/types";

export async function getTemplates(req: Request, res: Response): Promise<void> {
    try {
        res.status(200).json(templates as AgentTemplate[]);
    } catch (error) {
        logger.error('Error fetching templates', { error });
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
}
