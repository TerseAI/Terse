import { Request, Response } from "express";
import { db } from "../prismaClient";
import logger from "../logger";

export interface DirectiveRecord {
    id: string;
    automationId: string;
    runHistoryRecordId: string;
    runHistoryChatEventId: string;
    directiveDescription: string;
    isActive: boolean;
    createdAt: string;
}

// GET /agents/:agentId/directives - List all directives for an agent
export async function getAgentDirectives(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const agentId = req.params.agentId;

    try {
        const prisma = db();

        // Verify the agent belongs to the user
        const agent = await prisma.automations.findFirst({
            where: {
                id: agentId,
                user_id: userId
            }
        });

        if (!agent) {
            res.status(404).json({ error: 'Agent not found' });
            return;
        }

        // Get all directives for the agent
        const directives = await prisma.directive_records.findMany({
            where: {
                automation_id: agentId
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        // Transform to frontend format
        const response: DirectiveRecord[] = directives.map(d => ({
            id: d.id,
            automationId: d.automation_id,
            runHistoryRecordId: d.run_history_record_id,
            runHistoryChatEventId: d.run_history_chat_event_id,
            directiveDescription: d.directive_description,
            isActive: d.is_active,
            createdAt: d.created_at.toISOString()
        }));

        res.status(200).json(response);
    } catch (error) {
        logger.error('Error fetching directives', { error, userId, agentId });
        res.status(500).json({ error: 'Failed to fetch directives' });
    }
}

// DELETE /agents/:agentId/directives/:directiveId - Delete a directive
export async function deleteDirective(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const { agentId, directiveId } = req.params;

    try {
        const prisma = db();

        // Verify the agent belongs to the user
        const agent = await prisma.automations.findFirst({
            where: {
                id: agentId,
                user_id: userId
            }
        });

        if (!agent) {
            res.status(404).json({ error: 'Agent not found' });
            return;
        }

        // Verify the directive exists and belongs to the agent
        const directive = await prisma.directive_records.findFirst({
            where: {
                id: directiveId,
                automation_id: agentId
            }
        });

        if (!directive) {
            res.status(404).json({ error: 'Directive not found' });
            return;
        }

        // Delete the directive
        await prisma.directive_records.delete({
            where: { id: directiveId }
        });

        res.status(200).json({ success: true, message: 'Directive deleted successfully' });
    } catch (error) {
        logger.error('Error deleting directive', { error, userId, agentId, directiveId });
        res.status(500).json({ error: 'Failed to delete directive' });
    }
}
