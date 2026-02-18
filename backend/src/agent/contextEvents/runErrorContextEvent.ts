import type { AgentInputItem } from "@openai/agents-core"

import type { ClassifiedError } from "../agentErrorUtils"

import { BaseContextEvent } from "./BaseContextEvent"
import { appendContextEventToBuilderSession, appendContextEventToRunHistory } from "./contextEventSessions"

type RunErrorContextEventPayload = {
    kind: "run_error"
    error: string
    code?: string
    hint?: string
}

export type ParsedRunErrorContextEvent = {
    error: string
    code?: string
}

class RunErrorContextEvent extends BaseContextEvent<RunErrorContextEventPayload, ParsedRunErrorContextEvent> {
    constructor() {
        super("run_error")
    }

    protected decodePayload(payload: unknown): ParsedRunErrorContextEvent | null {
        const parsed = this.asRecord(payload)
        if (!parsed) return null

        if (this.getRequiredString(parsed, "kind") !== "run_error") return null
        const error = this.getRequiredNonEmptyString(parsed, "error")
        if (!error) return null
        const code = this.getOptionalString(parsed, "code")

        return {
            error,
            ...(code ? { code } : {})
        }
    }
}

const runErrorContextEvent = new RunErrorContextEvent()

function buildPayload(classified: ClassifiedError): RunErrorContextEventPayload {
    const payload: RunErrorContextEventPayload = {
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

function buildText(classified: ClassifiedError): string {
    if (classified.code) {
        return `Run error (${classified.code}): ${classified.message}`
    }
    return `Run error: ${classified.message}`
}

export function buildRunErrorContextEventItem(classified: ClassifiedError): AgentInputItem {
    return runErrorContextEvent.createItem(buildPayload(classified), buildText(classified))
}

export function parseRunErrorContextEventItem(item: unknown): ParsedRunErrorContextEvent | null {
    return runErrorContextEvent.parseItem(item)
}

export async function appendRunHistoryErrorContextEvent(runId: string, classified: ClassifiedError): Promise<void> {
    await appendContextEventToRunHistory(runId, buildRunErrorContextEventItem(classified))
}

export async function appendBuilderChatErrorContextEvent(sessionId: string, classified: ClassifiedError): Promise<void> {
    await appendContextEventToBuilderSession(sessionId, buildRunErrorContextEventItem(classified))
}
