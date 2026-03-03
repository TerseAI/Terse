import type { AgentInputItem } from "@openai/agents-core"
import { z } from "zod"

import { randomString } from "../../utility/strings"

import { BaseSystemEvent } from "./BaseSystemEvent"
import { appendSystemEventToBuilderSession, appendSystemEventToRunHistory } from "./systemEventSessions"

const cancelledSystemEventPayloadSchema = z.object({
    kind: z.literal("cancelled"),
    id: z.string().trim().min(1).optional(),
    reason: z.string().trim().min(1).optional()
})

type CancelledSystemEventPayload = z.infer<typeof cancelledSystemEventPayloadSchema>

export type ParsedCancelledSystemEvent = {
    reason?: string
}

type CancelledSystemEventOptions = {
    cancelledEventId?: string
}

class CancelledSystemEvent extends BaseSystemEvent<CancelledSystemEventPayload, ParsedCancelledSystemEvent> {
    constructor() {
        super(cancelledSystemEventPayloadSchema)
    }

    protected decodePayload(payload: CancelledSystemEventPayload): ParsedCancelledSystemEvent | null {
        if (payload.reason) {
            return { reason: payload.reason }
        }
        return {}
    }
}

const cancelledSystemEvent = new CancelledSystemEvent()

function resolveCancelledEventId(options?: CancelledSystemEventOptions): string {
    const explicit = options?.cancelledEventId?.trim()
    if (explicit) {
        return explicit
    }
    return randomString(18)
}

function buildPayload(reason?: string, options?: CancelledSystemEventOptions): CancelledSystemEventPayload {
    const cancelledEventId = resolveCancelledEventId(options)
    const payload: CancelledSystemEventPayload = {
        kind: "cancelled",
        id: `msg_cancelled-${cancelledEventId}`
    }

    const normalizedReason = reason?.trim()
    if (normalizedReason) {
        payload.reason = normalizedReason
    }

    return payload
}

export function buildCancelledSystemEventItem(reason?: string, options?: CancelledSystemEventOptions): AgentInputItem {
    return cancelledSystemEvent.createItem(buildPayload(reason, options))
}

export function parseCancelledSystemEventItem(item: unknown): ParsedCancelledSystemEvent | null {
    return cancelledSystemEvent.parseItem(item)
}

export async function appendRunHistoryCancelledSystemEvent(runId: string, reason?: string, options?: CancelledSystemEventOptions): Promise<void> {
    await appendSystemEventToRunHistory(runId, buildCancelledSystemEventItem(reason, options))
}

export async function appendBuilderChatCancelledSystemEvent(sessionId: string, reason?: string, options?: CancelledSystemEventOptions): Promise<void> {
    await appendSystemEventToBuilderSession(sessionId, buildCancelledSystemEventItem(reason, options))
}
