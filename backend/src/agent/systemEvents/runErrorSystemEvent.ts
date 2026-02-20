import type { AgentInputItem } from "@openai/agents-core"
import { z } from "zod"

import { randomString } from "../../utility/strings"
import type { ClassifiedError } from "../agentErrorUtils"

import { BaseSystemEvent } from "./BaseSystemEvent"
import { appendSystemEventToBuilderSession, appendSystemEventToRunHistory } from "./systemEventSessions"

const runErrorSystemEventPayloadSchema = z.object({
    kind: z.literal("run_error"),
    id: z.string().trim().min(1).optional(),
    run_error_id: z.string().trim().min(1).optional(),
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

export type RunErrorSystemEventOptions = {
    runErrorId?: string
}

function resolveRunErrorId(options?: RunErrorSystemEventOptions): string {
    const explicit = options?.runErrorId?.trim()
    if (explicit) {
        return explicit
    }

    return randomString(18)
}

function buildPayload(classified: ClassifiedError, options?: RunErrorSystemEventOptions): RunErrorSystemEventPayload {
    const runErrorId = resolveRunErrorId(options)
    const payload: RunErrorSystemEventPayload = {
        kind: "run_error",
        id: `msg_run_error-${runErrorId}`,
        run_error_id: runErrorId,
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

export function buildRunErrorSystemEventItem(classified: ClassifiedError, options?: RunErrorSystemEventOptions): AgentInputItem {
    return runErrorSystemEvent.createItem(buildPayload(classified, options))
}

export function parseRunErrorSystemEventItem(item: unknown): ParsedRunErrorSystemEvent | null {
    return runErrorSystemEvent.parseItem(item)
}

export async function appendRunHistoryErrorSystemEvent(runId: string, classified: ClassifiedError, options?: RunErrorSystemEventOptions): Promise<void> {
    await appendSystemEventToRunHistory(runId, buildRunErrorSystemEventItem(classified, options))
}

export async function appendBuilderChatErrorSystemEvent(sessionId: string, classified: ClassifiedError, options?: RunErrorSystemEventOptions): Promise<void> {
    await appendSystemEventToBuilderSession(sessionId, buildRunErrorSystemEventItem(classified, options))
}
