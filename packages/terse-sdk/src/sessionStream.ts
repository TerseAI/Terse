import { ApiRoutes } from "terse-types"
import type { SdkAgentStreamEvent, SdkListenStreamEvent } from "terse-types"

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

export type ListenStreamHandle = {
    listenerId: string
    organizationId: string
    jobName: string
    close: () => void
}

export type OpenListenStreamOptions = {
    /** Name of the deployed SDK job to listen for. The backend filters events server-side. */
    jobName: string
    /**
     * Invoked for each SSE `data:` JSON event after the initial `listen_started`
     * (that event is consumed internally to obtain `listenerId`/`organizationId`).
     */
    onEvent?: (event: SdkListenStreamEvent) => void | Promise<void>
}

/**
 * Thrown when {@link openSessionStream} or {@link openListenStream} cannot
 * establish the SSE connection. Exposes the HTTP `status` so callers can
 * distinguish auth failures (401/403) from other transport errors.
 */
export class SessionStreamError extends Error {
    readonly status: number

    constructor(status: number, message?: string) {
        super(message ?? `Failed to open SSE stream (HTTP ${status})`)
        this.name = "SessionStreamError"
        this.status = status
    }
}

/**
 * Opens the Terse SSE session used for live run/tool events (same endpoint as the `terse` CLI).
 * Keeps the stream draining until `close()` is called.
 *
 * Throws {@link SessionStreamError} if the server responds with a non-2xx status.
 */
export async function openSessionStream(apiBaseUrl: string, apiKey: string, options: OpenSessionStreamOptions = {}): Promise<SessionStreamHandle> {
    const reader = await openSseReader(apiBaseUrl, ApiRoutes.SDK.SESSION_EVENTS, apiKey)
    const decoder = new TextDecoder()

    const handshake = await readUntilEvent<SessionStreamEvent>(reader, decoder, "", event => event.type === "session_started")
    const startedEvent = handshake.event as SessionStartedEvent
    if (typeof startedEvent.sessionId !== "string") {
        throw new SessionStreamError(0, "Session stream did not return a sessionId")
    }

    consumeSseEvents<SessionStreamEvent>(reader, decoder, handshake.remainingBuffer, options.onEvent)

    return {
        sessionId: startedEvent.sessionId,
        close: () => {
            reader.cancel().catch(() => {})
        }
    }
}

/**
 * Opens the SSE stream that backs `terse listen`. The backend mirrors every
 * trigger event it dispatches to a deployed agent in the caller's
 * organization onto this stream.
 *
 * The first event is always `listen_started` (consumed here to surface
 * `listenerId`/`organizationId`); subsequent events flow to `onEvent`.
 *
 * Throws {@link SessionStreamError} if the server responds with a non-2xx status.
 */
export async function openListenStream(apiBaseUrl: string, apiKey: string, options: OpenListenStreamOptions): Promise<ListenStreamHandle> {
    const route = `${ApiRoutes.SDK.LISTEN}?jobName=${encodeURIComponent(options.jobName)}`
    const reader = await openSseReader(apiBaseUrl, route, apiKey)
    const decoder = new TextDecoder()

    const handshake = await readUntilEvent<SdkListenStreamEvent>(reader, decoder, "", event => event.type === "listen_started")
    if (handshake.event.type !== "listen_started") {
        throw new SessionStreamError(0, "Listen stream did not return a listen_started event")
    }
    const { listenerId, organizationId, jobName } = handshake.event

    consumeSseEvents<SdkListenStreamEvent>(reader, decoder, handshake.remainingBuffer, options.onEvent)

    return {
        listenerId,
        organizationId,
        jobName,
        close: () => {
            reader.cancel().catch(() => {})
        }
    }
}

async function openSseReader(apiBaseUrl: string, route: string, apiKey: string): Promise<ReadableStreamDefaultReader<Uint8Array>> {
    const base = apiBaseUrl.replace(/\/$/, "")
    const response = await fetch(`${base}${route}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "text/event-stream" }
    })

    if (!response.ok || !response.body) {
        throw new SessionStreamError(response.status)
    }

    return response.body.getReader()
}

async function readUntilEvent<TEvent extends { type: string }>(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder,
    initialBuffer: string,
    predicate: (event: TEvent) => boolean
): Promise<{ event: TEvent; remainingBuffer: string }> {
    let buffer = initialBuffer
    while (true) {
        const { done, value } = await reader.read()
        if (done) {
            throw new SessionStreamError(0, "SSE stream ended before handshake completed")
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const event = parseSseEvent<TEvent>(line.slice(6))
            if (event && predicate(event)) {
                return { event, remainingBuffer: buffer }
            }
        }
    }
}

function consumeSseEvents<TEvent extends { type: string }>(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder,
    initialBuffer: string,
    onEvent?: (event: TEvent) => void | Promise<void>
): void {
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
                    const event = parseSseEvent<TEvent>(line.slice(6))
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

function parseSseEvent<TEvent extends { type: string }>(raw: string): TEvent | null {
    const parsed = safeParseJson(raw)
    if (!parsed || typeof parsed.type !== "string") return null
    return parsed as TEvent
}

function safeParseJson(value: string): Record<string, unknown> | null {
    try {
        return JSON.parse(value) as Record<string, unknown>
    } catch {
        return null
    }
}
