import { z } from "zod"

import logger from "../../logger"
import { getSocketIO } from "../../services/CacheInvalidationService"
import type { ChatSnippet } from "../../shared/ModelEvents"
import type { RunHistoryModelEvent, RunHistoryModelSocketEvent } from "../../shared/RunHistoryTypes"
import { SocketEvents, SocketRooms } from "../../shared/SocketEvents"
import { randomString } from "../../utility/strings"
import { nextRunStreamSequence } from "../streamSequence"

import { appendSnippetSystemEvent, buildSnippetSystemEventId, chatSnippetPayloadSchema } from "./snippetSystemEvent"

const emitAndPersistSnippetEventInputSchema = z.object({
    runId: z.string().trim().min(1),
    organizationId: z.string().trim().min(1),
    agentId: z.string().trim().min(1),
    snippet: chatSnippetPayloadSchema
})

export type EmitAndPersistSnippetEventInput = {
    runId: string | null | undefined
    organizationId: string | null | undefined
    agentId: string | null | undefined
    snippet: ChatSnippet | null | undefined
}

export async function emitAndPersistSnippetEvent(input: EmitAndPersistSnippetEventInput): Promise<void> {
    const parsed = emitAndPersistSnippetEventInputSchema.safeParse({
        runId: input.runId,
        organizationId: input.organizationId,
        agentId: input.agentId,
        snippet: input.snippet
    })

    if (!parsed.success) {
        logger.warn("emitAndPersistSnippetEvent: invalid context, skipping snippet emission/persistence", {
            errors: parsed.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })),
            runId: input.runId,
            organizationId: input.organizationId,
            agentId: input.agentId
        })
        return
    }

    const { runId, organizationId, agentId, snippet } = parsed.data
    const timestamp = Date.now()
    const normalizedSnippet: ChatSnippet = { ...snippet }
    const eventId = buildSnippetSystemEventId(randomString(18))

    try {
        await appendSnippetSystemEvent(runId, {
            id: eventId,
            snippet: normalizedSnippet
        })
    } catch (error) {
        logger.warn("emitAndPersistSnippetEvent: failed to persist snippet system event", {
            runId,
            organizationId,
            agentId,
            error
        })
    }

    const io = getSocketIO()
    if (!io) {
        logger.warn("emitAndPersistSnippetEvent: socket not available, skipped live snippet emit", {
            runId,
            organizationId,
            agentId
        })
        return
    }

    try {
        const runHistoryModelEvent: RunHistoryModelEvent = {
            type: "Snippet",
            snippet: normalizedSnippet,
            id: eventId,
            timestamp: timestamp,
            stream_seq: nextRunStreamSequence(runId)
        }
        const payload: RunHistoryModelSocketEvent = {
            runId,
            agentId,
            runHistoryModelEvent
        }
        io.to(SocketRooms.organization(organizationId)).emit(SocketEvents.AGENT_CHAT_EVENT, payload)
    } catch (error) {
        logger.warn("emitAndPersistSnippetEvent: failed to emit live snippet event", {
            runId,
            organizationId,
            agentId,
            error
        })
    }
}
