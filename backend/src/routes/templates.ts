import { Request, Response } from "express";
import templates from "../templates/templates.json";
import logger from "../logger";

export async function getTemplates(req: Request, res: Response): Promise<void> {
    try {
        res.status(200).json(templates);
    } catch (error) {
        logger.error('Error fetching templates', { error });
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
}