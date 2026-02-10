import { AgentInputItem } from "@openai/agents-core"
import { Request, Response } from "express"

import { type TimestampedAgentInputItem, convertAgentInputItemsToModelEvents } from "../agent/agentInputItemsToModelEvents"
import logger from "../logger"
import { PrismaClient, db } from "../prismaClient"

/**
 * Get chat history for a builder chat session
 * Route: GET /builder-chat/:sessionId/history
 *
 * Fetches AgentInputItems from chat_raw_events and converts them to ModelEvents
 * for display in the chat UI.
 */
export async function getBuilderChatHistory(req: Request, res: Response) {
    try {
        const prisma: PrismaClient = db()

        const sessionId = (req.params.sessionId as string | undefined)?.trim()
        if (!sessionId) {
            return res.status(400).json({ error: "sessionId is required" })
        }

        // Fetch all raw events for this session, ordered by sequence
        const rawEvents = await prisma.chat_raw_events.findMany({
            where: {
                chat_session_id: sessionId
            },
            orderBy: [
                { sequence_order: "asc" },
                { created_at: "asc" } // Fallback for items without sequence_order
            ],
            select: {
                raw_event_json: true,
                created_at: true
            }
        })

        if (rawEvents.length === 0) {
            return res.json({
                events: [],
                startTimestamp: null,
                endTimestamp: null
            })
        }

        // Zip AgentInputItems with their created_at timestamps
        const timestampedItems: TimestampedAgentInputItem[] = rawEvents.map(event => ({
            item: event.raw_event_json as AgentInputItem,
            createdAt: event.created_at
        }))

        // Convert to ModelEvents for the UI, stamping each with its source timestamp
        const modelEvents = convertAgentInputItemsToModelEvents(timestampedItems)

        // Add per-event id and convert epoch ms → ISO string (matching RunHistoryModelEvent shape)
        const firstTimestamp = rawEvents[0]?.created_at?.toISOString()
        const events = modelEvents.map((event, i) => ({
            ...event,
            id: `builder-hist-${i}`,
            timestamp: event.timestamp ? new Date(event.timestamp).toISOString() : firstTimestamp
        }))

        // Get timestamps
        const startTimestamp = rawEvents[0]?.created_at?.toISOString() ?? null
        const endTimestamp = rawEvents[rawEvents.length - 1]?.created_at?.toISOString() ?? null

        res.json({
            events,
            startTimestamp,
            endTimestamp
        })
    } catch (err) {
        logger.error("Failed to fetch builder chat history", {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
            sessionId: req.params.sessionId
        })
        res.status(500).json({ error: "Failed to fetch builder chat history" })
    }
}
