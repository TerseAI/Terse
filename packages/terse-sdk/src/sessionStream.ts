import { ApiRoutes } from "terse-types"
import type { SdkAgentStreamEvent } from "terse-types"

export type SessionStartedEvent = { type: "session_started"; sessionId: string }

export type SessionStreamEvent = SdkAgentStreamEvent | SessionStartedEvent

export type SessionStreamHandle = {
    sessionId: string
    close: () => void
}

export type OpenSessionStreamOptions = {
    /**
     * Invoked for each SSE `data:` JSON event after the initial `session_started`
     * (that event is consumed internally to obtain `sessionId`).
     */
    onEvent?: (event: SessionStreamEvent) => void | Promise<void>
}

/**
 * Opens the Terse SSE session used for live run/tool events (same endpoint as the `terse` CLI).
 * Keeps the stream draining until `close()` is called.
 */
export async function openSessionStream(apiBaseUrl: string, apiKey: string, options: OpenSessionStreamOptions = {}): Promise<SessionStreamHandle> {
    const base = apiBaseUrl.replace(/\/$/, "")
    const response = await fetch(`${base}${ApiRoutes.SDK.SESSION_EVENTS}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "text/event-stream" }
    })

    if (!response.ok || !response.body) {
        throw new Error(`Failed to open session event stream (HTTP ${response.status})`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    const { value, remainingBuffer } = await readSessionId(reader, decoder, buffer)
    consumeSseSessionEvents(reader, decoder, remainingBuffer, options.onEvent)

    return {
        sessionId: value,
        close: () => {
            reader.cancel().catch(() => {})
        }
    }
}

async function readSessionId(reader: ReadableStreamDefaultReader<Uint8Array>, decoder: TextDecoder, buffer: string): Promise<{ value: string; remainingBuffer: string }> {
    while (true) {
        const { done, value } = await reader.read()
        if (done) {
            throw new Error("Session stream ended before sending sessionId")
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const event = safeParseJson(line.slice(6))
            if (event?.type === "session_started" && typeof event.sessionId === "string") {
                return { value: event.sessionId, remainingBuffer: buffer }
            }
        }
    }
}

function consumeSseSessionEvents(reader: ReadableStreamDefaultReader<Uint8Array>, decoder: TextDecoder, initialBuffer: string, onEvent?: (event: SessionStreamEvent) => void | Promise<void>): void {
    let buffer = initialBuffer
    void (async () => {
        try {
            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split("\n")
                buffer = lines.pop() ?? ""

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue
                    const event = parseSessionStreamEvent(line.slice(6))
                    if (!event) continue
                    if (onEvent) {
                        await onEvent(event)
                    }
                }
            }
        } catch {
            // Stream cancelled via close() — expected
        }
    })()
}

function parseSessionStreamEvent(raw: string): SessionStreamEvent | null {
    const parsed = safeParseJson(raw)
    if (!parsed || typeof parsed.type !== "string") return null
    return parsed as SessionStreamEvent
}

function safeParseJson(value: string): Record<string, unknown> | null {
    try {
        return JSON.parse(value) as Record<string, unknown>
    } catch {
        return null
    }
}
