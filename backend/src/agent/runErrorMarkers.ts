import { system } from "@openai/agents"
import type { AgentInputItem } from "@openai/agents-core"

import { ChatMemorySession, RunHistoryChatMemorySession } from "./CustomMemorySession"
import type { ClassifiedError } from "./agentErrorUtils"

const RUN_ERROR_MARKER_VERSION = "TERSE_RUN_ERROR_MARKER_V1"
const MARKER_START = `<${RUN_ERROR_MARKER_VERSION}>`
const MARKER_END = `</${RUN_ERROR_MARKER_VERSION}>`

type RunErrorMarkerPayload = {
    kind: "global_run_error"
    error: string
    code?: string
    hint?: string
}

export type ParsedRunErrorMarker = {
    error: string
    code?: string
}

function buildMarkerPayload(classified: ClassifiedError): RunErrorMarkerPayload {
    const payload: RunErrorMarkerPayload = {
        kind: "global_run_error",
        error: classified.message
    }

    if (classified.code) {
        payload.code = classified.code
    }

    // Soft guidance only; we still allow the user/model to continue and retry.
    if (classified.code === "context_length_exceeded") {
        payload.hint = "Previous attempt exceeded context limits. Continue by reducing scope/context and keeping output concise."
    }

    return payload
}

function encodeMarker(payload: RunErrorMarkerPayload): string {
    return `${MARKER_START}\n${JSON.stringify(payload)}\n${MARKER_END}`
}

function decodeMarker(content: string): RunErrorMarkerPayload | null {
    const start = content.indexOf(MARKER_START)
    if (start === -1) return null

    const end = content.indexOf(MARKER_END, start + MARKER_START.length)
    if (end === -1) return null

    const serialized = content.slice(start + MARKER_START.length, end).trim()
    if (!serialized) return null

    try {
        const parsed = JSON.parse(serialized) as Partial<RunErrorMarkerPayload>
        if (parsed.kind !== "global_run_error") return null
        if (typeof parsed.error !== "string" || parsed.error.trim().length === 0) return null

        return {
            kind: "global_run_error",
            error: parsed.error,
            ...(typeof parsed.code === "string" && parsed.code ? { code: parsed.code } : {}),
            ...(typeof parsed.hint === "string" && parsed.hint ? { hint: parsed.hint } : {})
        }
    } catch {
        return null
    }
}

function extractSystemMessageText(item: unknown): string | null {
    if (!item || typeof item !== "object") return null

    const maybeMessage = item as {
        role?: unknown
        content?: unknown
        type?: unknown
    }

    if (maybeMessage.role !== "system") return null
    if (typeof maybeMessage.content === "string") return maybeMessage.content

    if (Array.isArray(maybeMessage.content)) {
        const text = maybeMessage.content
            .map(part => {
                if (typeof part !== "object" || !part) return ""
                const p = part as { text?: unknown; input_text?: unknown; type?: unknown }
                if (typeof p.text === "string") return p.text
                if (typeof p.input_text === "string") return p.input_text
                return ""
            })
            .join("\n")
            .trim()
        return text.length > 0 ? text : null
    }

    return null
}

export function buildRunErrorMarkerItem(classified: ClassifiedError): AgentInputItem {
    const payload = buildMarkerPayload(classified)
    const content = encodeMarker(payload)
    return system(content) as AgentInputItem
}

export function parseRunErrorMarkerItem(item: unknown): ParsedRunErrorMarker | null {
    const content = extractSystemMessageText(item)
    if (!content) return null

    const marker = decodeMarker(content)
    if (!marker) return null

    return {
        error: marker.error,
        ...(marker.code ? { code: marker.code } : {})
    }
}

export async function appendRunHistoryErrorMarker(runId: string, classified: ClassifiedError): Promise<void> {
    const session = new RunHistoryChatMemorySession({ sessionId: runId })
    await session.addItems([buildRunErrorMarkerItem(classified)])
}

export async function appendBuilderChatErrorMarker(sessionId: string, classified: ClassifiedError): Promise<void> {
    const session = new ChatMemorySession({ sessionId })
    await session.addItems([buildRunErrorMarkerItem(classified)])
}
