import type { AgentInputItem } from "@openai/agents-core"
import { z } from "zod"

import type { ClassifiedError } from "../agentErrorUtils"

import { BaseSystemEvent } from "./BaseSystemEvent"
import { appendSystemEventToBuilderSession, appendSystemEventToRunHistory } from "./systemEventSessions"

const runErrorSystemEventPayloadSchema = z.object({
    kind: z.literal("run_error"),
    error: z.string().trim().min(1),
    code: z.string().optional(),
    hint: z.string().optional()
})

type RunErrorSystemEventPayload = z.infer<typeof runErrorSystemEventPayloadSchema>

export type ParsedRunErrorSystemEvent = {
    error: string
    code?: string
}

class RunErrorSystemEvent extends BaseSystemEvent<RunErrorSystemEventPayload, ParsedRunErrorSystemEvent> {
    constructor() {
        super(runErrorSystemEventPayloadSchema)
    }

    protected decodePayload(payload: RunErrorSystemEventPayload): ParsedRunErrorSystemEvent | null {
        return {
            error: payload.error,
            ...(payload.code ? { code: payload.code } : {})
        }
    }
}

const runErrorSystemEvent = new RunErrorSystemEvent()

function buildPayload(classified: ClassifiedError): RunErrorSystemEventPayload {
    const payload: RunErrorSystemEventPayload = {
        kind: "run_error",
        error: classified.message
    }

    if (classified.code) {
        payload.code = classified.code
    }

    if (classified.code === "context_length_exceeded") {
        payload.hint = "Previous attempt exceeded context limits. Continue by reducing scope/context and keeping output concise."
    }

    return payload
}

export function buildRunErrorSystemEventItem(classified: ClassifiedError): AgentInputItem {
    return runErrorSystemEvent.createItem(buildPayload(classified))
}

export function parseRunErrorSystemEventItem(item: unknown): ParsedRunErrorSystemEvent | null {
    return runErrorSystemEvent.parseItem(item)
}

export async function appendRunHistoryErrorSystemEvent(runId: string, classified: ClassifiedError): Promise<void> {
    await appendSystemEventToRunHistory(runId, buildRunErrorSystemEventItem(classified))
}

export async function appendBuilderChatErrorSystemEvent(sessionId: string, classified: ClassifiedError): Promise<void> {
    await appendSystemEventToBuilderSession(sessionId, buildRunErrorSystemEventItem(classified))
}
