import { Request, Response } from "express";
import { AgentInputItem } from "@openai/agents-core";
import { db, PrismaClient } from "../prismaClient";
import { convertAgentInputItemsToModelEvents } from "../agent/agentInputItemsToModelEvents";
import logger from "../logger";

/**
 * Get chat history for a builder chat session
 * Route: GET /builder-chat/:sessionId/history
 *
 * Fetches AgentInputItems from chat_raw_events and converts them to ModelEvents
 * for display in the chat UI.
 */
export async function getBuilderChatHistory(req: Request, res: Response) {
    try {
        const prisma: PrismaClient = db();

        const sessionId = (req.params.sessionId as string | undefined)?.trim();
        if (!sessionId) {
            return res.status(400).json({ error: "sessionId is required" });
        }

        // Fetch all raw events for this session, ordered by sequence
        const rawEvents = await prisma.chat_raw_events.findMany({
            where: {
                chat_session_id: sessionId,
            },
            orderBy: [
                { sequence_order: "asc" },
                { created_at: "asc" }, // Fallback for items without sequence_order
            ],
            select: {
                raw_event_json: true,
                created_at: true,
            },
        });

        if (rawEvents.length === 0) {
            return res.json({
                events: [],
                startTimestamp: null,
                endTimestamp: null,
            });
        }

        // Extract AgentInputItems from the raw events
        const agentInputItems = rawEvents.map(
            (event) => event.raw_event_json as AgentInputItem
        );

        // Convert to ModelEvents for the UI
        const modelEvents = convertAgentInputItemsToModelEvents(agentInputItems);

        // Get timestamps
        const startTimestamp = rawEvents[0]?.created_at?.toISOString() ?? null;
        const endTimestamp =
            rawEvents[rawEvents.length - 1]?.created_at?.toISOString() ?? null;

        res.json({
            events: modelEvents,
            startTimestamp,
            endTimestamp,
        });
    } catch (err) {
        logger.error("Failed to fetch builder chat history", {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
            sessionId: req.params.sessionId,
        });
        res.status(500).json({ error: "Failed to fetch builder chat history" });
    }
}
