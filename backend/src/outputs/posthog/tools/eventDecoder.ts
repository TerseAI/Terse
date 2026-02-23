/**
 * Event decoder for PostHog session replay events.
 * Fetches, decompresses, and parses session events from PostHog.
 */
import { gunzipSync, strFromU8, strToU8 } from "fflate"

import logger from "../../../logger"

// rrweb event types (from @rrweb/types)
export enum EventType {
    DomContentLoaded = 0,
    Load = 1,
    FullSnapshot = 2,
    IncrementalSnapshot = 3,
    Meta = 4,
    Custom = 5,
    Plugin = 6
}

export enum IncrementalSource {
    Mutation = 0,
    MouseMove = 1,
    MouseInteraction = 2,
    Scroll = 3,
    ViewportResize = 4,
    Input = 5,
    TouchMove = 6,
    MediaInteraction = 7,
    StyleSheetRule = 8,
    CanvasMutation = 9,
    Font = 10,
    Log = 11,
    Drag = 12,
    StyleDeclaration = 13,
    Selection = 14,
    AdoptedStyleSheet = 15
}

export enum MouseInteractions {
    MouseUp = 0,
    MouseDown = 1,
    Click = 2,
    ContextMenu = 3,
    DblClick = 4,
    Focus = 5,
    Blur = 6,
    TouchStart = 7,
    TouchMove_Departed = 8,
    TouchEnd = 9,
    TouchCancel = 10
}

export interface eventWithTime {
    type: EventType
    data: any
    timestamp: number
    delay?: number
}

interface CompressedEvent extends eventWithTime {
    cv: string // compression version
}

export interface SessionSnapshot {
    source: string
    start_timestamp: string
    end_timestamp: string
    blob_key: string
}

interface SessionResponse {
    sources: SessionSnapshot[]
}

interface RecordingSnapshot extends eventWithTime {
    windowId: number
}

/**
 * Summarized event types returned to the AI
 */
export interface SummarizedEvent {
    type: "click" | "input" | "scroll" | "console" | "network_error" | "navigation" | "custom" | "page_load" | "viewport_resize"
    timestamp: number
    relativeTime: number // seconds from session start
    data: Record<string, any>
}

export interface SessionEventsResult {
    sessionId: string
    sessionUrl: string
    startTime: string
    duration?: number
    totalRawEvents: number
    events: SummarizedEvent[]
    consoleLogs: Array<{ timestamp: string; level: string; message: string }>
}

// Check if event is compressed
function isCompressedEvent(ev: unknown): ev is CompressedEvent {
    return typeof ev === "object" && ev !== null && "cv" in ev
}

// Decompress gzip data
function unzip(compressedStr: string | undefined): any {
    if (!compressedStr) {
        return undefined
    }
    try {
        return JSON.parse(strFromU8(gunzipSync(strToU8(compressedStr, true))))
    } catch (e) {
        logger.warn("Failed to decompress data", { error: e })
        return undefined
    }
}

// Decompress individual event if compressed
function decompressEvent(ev: unknown): unknown {
    try {
        if (isCompressedEvent(ev)) {
            if (ev.cv === "2024-10") {
                if (ev.type === EventType.FullSnapshot) {
                    return {
                        ...ev,
                        data: unzip(ev.data)
                    }
                } else if (ev.type === EventType.IncrementalSnapshot) {
                    if (ev.data?.source === IncrementalSource.StyleSheetRule) {
                        return {
                            ...ev,
                            data: {
                                ...ev.data,
                                source: IncrementalSource.StyleSheetRule,
                                adds: unzip(ev.data.adds),
                                removes: unzip(ev.data.removes)
                            }
                        }
                    } else if (ev.data?.source === IncrementalSource.Mutation) {
                        return {
                            ...ev,
                            data: {
                                ...ev.data,
                                source: IncrementalSource.Mutation,
                                adds: unzip(ev.data.adds),
                                removes: unzip(ev.data.removes),
                                texts: unzip(ev.data.texts),
                                attributes: unzip(ev.data.attributes)
                            }
                        }
                    }
                }
            }
        }
        return ev
    } catch (e) {
        logger.warn("Error decompressing event", { error: e })
        return ev
    }
}

// Window ID registry for tracking windows
type RegisterWindowIdCallback = (uuid: string) => number

function createWindowIdRegistry(): RegisterWindowIdCallback {
    const uuidToIndex: Record<string, number> = {}
    return (uuid: string): number => {
        if (uuid in uuidToIndex) {
            return uuidToIndex[uuid]
        }
        const index = Object.keys(uuidToIndex).length + 1
        uuidToIndex[uuid] = index
        return index
    }
}

// Parse encoded snapshots from NDJSON format
async function parseEncodedSnapshots(items: string[], sessionId: string): Promise<RecordingSnapshot[]> {
    const registerFn = createWindowIdRegistry()
    const parsedLines: RecordingSnapshot[] = []

    for (const line of items) {
        if (!line || !line.trim()) continue

        try {
            let snapshotLine = JSON.parse(line)

            // Handle array format [windowId, event]
            if (Array.isArray(snapshotLine)) {
                snapshotLine = {
                    windowId: snapshotLine[0],
                    data: [snapshotLine[1]]
                }
            }

            const windowIdStr = snapshotLine.windowId ?? snapshotLine.window_id
            if (!windowIdStr || !snapshotLine.data || !Array.isArray(snapshotLine.data)) {
                continue
            }

            const windowIdNum = typeof windowIdStr === "string" ? registerFn(windowIdStr) : windowIdStr

            for (const event of snapshotLine.data) {
                const decompressedEvent = decompressEvent(event)
                if (decompressedEvent && typeof decompressedEvent === "object" && "type" in decompressedEvent && "timestamp" in decompressedEvent) {
                    parsedLines.push({
                        ...(decompressedEvent as eventWithTime),
                        windowId: windowIdNum
                    })
                }
            }
        } catch (e) {
            // Skip unparseable lines
            continue
        }
    }

    return parsedLines
}

/**
 * Extract meaningful events from raw rrweb events
 */
function extractMeaningfulEvents(events: RecordingSnapshot[], sessionStartTime: number, startSeconds?: number, endSeconds?: number): SummarizedEvent[] {
    const summarized: SummarizedEvent[] = []

    const startMs = startSeconds !== undefined ? sessionStartTime + startSeconds * 1000 : undefined
    const endMs = endSeconds !== undefined ? sessionStartTime + endSeconds * 1000 : undefined

    for (const event of events) {
        // Filter by time window
        if (startMs !== undefined && event.timestamp < startMs) continue
        if (endMs !== undefined && event.timestamp > endMs) continue

        const relativeTime = (event.timestamp - sessionStartTime) / 1000

        switch (event.type) {
            case EventType.Meta:
                // Page navigation/URL info
                if (event.data?.href) {
                    summarized.push({
                        type: "navigation",
                        timestamp: event.timestamp,
                        relativeTime,
                        data: {
                            url: event.data.href,
                            width: event.data.width,
                            height: event.data.height
                        }
                    })
                }
                break

            case EventType.FullSnapshot:
                // Full page snapshot - summarize only
                summarized.push({
                    type: "page_load",
                    timestamp: event.timestamp,
                    relativeTime,
                    data: {
                        description: "Full page snapshot captured"
                    }
                })
                break

            case EventType.IncrementalSnapshot:
                if (!event.data) continue

                switch (event.data.source) {
                    case IncrementalSource.MouseInteraction:
                        // Mouse interactions (clicks, etc.)
                        const interactionType = event.data.type
                        if (interactionType === MouseInteractions.Click || interactionType === MouseInteractions.DblClick || interactionType === MouseInteractions.ContextMenu) {
                            summarized.push({
                                type: "click",
                                timestamp: event.timestamp,
                                relativeTime,
                                data: {
                                    interactionType: MouseInteractions[interactionType] || interactionType,
                                    x: event.data.x,
                                    y: event.data.y,
                                    id: event.data.id
                                }
                            })
                        }
                        break

                    case IncrementalSource.Input:
                        // Form input changes
                        summarized.push({
                            type: "input",
                            timestamp: event.timestamp,
                            relativeTime,
                            data: {
                                id: event.data.id,
                                text: event.data.text?.substring(0, 100), // Truncate for safety
                                isChecked: event.data.isChecked
                            }
                        })
                        break

                    case IncrementalSource.Scroll:
                        // Scroll events - only include significant ones
                        summarized.push({
                            type: "scroll",
                            timestamp: event.timestamp,
                            relativeTime,
                            data: {
                                id: event.data.id,
                                x: event.data.x,
                                y: event.data.y
                            }
                        })
                        break

                    case IncrementalSource.ViewportResize:
                        summarized.push({
                            type: "viewport_resize",
                            timestamp: event.timestamp,
                            relativeTime,
                            data: {
                                width: event.data.width,
                                height: event.data.height
                            }
                        })
                        break
                }
                break

            case EventType.Custom:
                // Custom events (e.g., PostHog custom events)
                summarized.push({
                    type: "custom",
                    timestamp: event.timestamp,
                    relativeTime,
                    data: {
                        tag: event.data?.tag,
                        payload: event.data?.payload
                    }
                })
                break

            case EventType.Plugin:
                // Plugin events (often contain console logs, network info)
                if (event.data?.plugin === "rrweb/console@1") {
                    const payload = event.data.payload
                    if (payload) {
                        summarized.push({
                            type: "console",
                            timestamp: event.timestamp,
                            relativeTime,
                            data: {
                                level: payload.level,
                                trace: payload.trace?.slice(0, 3), // Limit stack trace
                                payload: JSON.stringify(payload.payload)?.substring(0, 500)
                            }
                        })
                    }
                } else if (event.data?.plugin === "rrweb/network@1") {
                    const payload = event.data.payload
                    // Only include failed requests
                    if (payload?.requests) {
                        for (const req of payload.requests) {
                            if (req.status >= 400 || req.status === 0) {
                                summarized.push({
                                    type: "network_error",
                                    timestamp: event.timestamp,
                                    relativeTime,
                                    data: {
                                        method: req.method,
                                        url: req.url,
                                        status: req.status,
                                        statusText: req.statusText,
                                        duration: req.duration
                                    }
                                })
                            }
                        }
                    }
                }
                break
        }
    }

    // Deduplicate consecutive scroll events (keep only significant changes)
    const deduped = deduplicateScrollEvents(summarized)

    return deduped
}

/**
 * Reduce noise from scroll events by keeping only significant position changes
 */
function deduplicateScrollEvents(events: SummarizedEvent[]): SummarizedEvent[] {
    const result: SummarizedEvent[] = []
    let lastScrollEvent: SummarizedEvent | null = null

    for (const event of events) {
        if (event.type === "scroll") {
            if (!lastScrollEvent) {
                lastScrollEvent = event
                result.push(event)
            } else {
                // Only include if scroll position changed significantly (> 200px)
                const deltaY = Math.abs((event.data.y || 0) - (lastScrollEvent.data.y || 0))
                const deltaX = Math.abs((event.data.x || 0) - (lastScrollEvent.data.x || 0))
                if (deltaY > 200 || deltaX > 200) {
                    lastScrollEvent = event
                    result.push(event)
                }
            }
        } else {
            // Reset scroll tracking when non-scroll event occurs
            lastScrollEvent = null
            result.push(event)
        }
    }

    return result
}

/**
 * PostHog Session Service - fetches and processes session events
 */
export class PostHogSessionService {
    private apiKey: string
    private projectId: string
    private apiBaseUrl: string

    constructor(apiKey: string, projectId: string, apiBaseUrl: string = "https://us.posthog.com") {
        this.apiKey = apiKey
        this.projectId = projectId
        this.apiBaseUrl = apiBaseUrl
    }

    /**
     * Get session details by session ID
     */
    async getSessionDetails(sessionId: string): Promise<{
        id: string
        duration?: number
        eventsCount: number
        startTime: string
        endTime?: string
    }> {
        const recordingsUrl = `${this.apiBaseUrl}/api/projects/${this.projectId}/session_recordings/${sessionId}/`

        const response = await fetch(recordingsUrl, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": "application/json"
            }
        })

        if (!response.ok) {
            const errorText = await response.text()
            if (response.status === 401) {
                throw new Error("PostHog API key is invalid or expired.")
            } else if (response.status === 404) {
                throw new Error(`Session ${sessionId} not found in PostHog.`)
            }
            throw new Error(`Failed to fetch session recording: ${errorText}`)
        }

        const recording = await response.json()

        return {
            id: sessionId,
            startTime: recording.start_time || recording.created_at || recording.timestamp,
            endTime: recording.end_time || recording.ended_at,
            duration: recording.recording_duration || recording.duration || recording.duration_seconds,
            eventsCount: recording.events_count || recording.event_count || 0
        }
    }

    /**
     * Fetch session snapshot sources
     */
    async getSessionSnapshots(sessionId: string): Promise<SessionSnapshot[]> {
        const response = await fetch(`${this.apiBaseUrl}/api/projects/${this.projectId}/session_recordings/${sessionId}/snapshots`, {
            headers: {
                Authorization: `Bearer ${this.apiKey}`
            }
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch session snapshots: ${response.statusText}`)
        }

        const data = (await response.json()) as SessionResponse
        return data.sources || []
    }

    /**
     * Fetch session events for given snapshots
     */
    async getSessionEvents(sessionId: string, sessionSnapshots: SessionSnapshot[]): Promise<string[]> {
        if (sessionSnapshots.length === 0) {
            return []
        }

        const dataKeys = sessionSnapshots.map(snapshot => snapshot.blob_key)
        const blobKeysAsInt = dataKeys.map(key => parseInt(key))
        const startKey = Math.min(...blobKeysAsInt)
        const endKey = Math.max(...blobKeysAsInt)
        const source = sessionSnapshots[0].source

        const response = await fetch(`${this.apiBaseUrl}/api/projects/${this.projectId}/session_recordings/${sessionId}/snapshots?source=${source}&start_blob_key=${startKey}&end_blob_key=${endKey}`, {
            headers: { Authorization: `Bearer ${this.apiKey}` }
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch session events: ${response.statusText}`)
        }

        const text = await response.text()
        return text.split("\n").filter(line => line.trim().length > 0)
    }

    /**
     * Fetch console logs for a session using PostHog Query API
     */
    async getConsoleLogs(sessionId: string): Promise<Array<{ timestamp: string; level: string; message: string }>> {
        const queryUrl = `${this.apiBaseUrl}/api/projects/${this.projectId}/query/`

        const hogqlQuery = `
            SELECT 
              timestamp,
              level,
              message
            FROM log_entries 
            WHERE log_source = 'session_replay'
              AND log_source_id = '${sessionId}'
            ORDER BY timestamp ASC
            LIMIT 10000
        `.trim()

        try {
            const response = await fetch(queryUrl, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    query: {
                        kind: "HogQLQuery",
                        query: hogqlQuery
                    }
                })
            })

            if (!response.ok) {
                logger.warn("Failed to fetch console logs from PostHog", { status: response.status })
                return []
            }

            const data = await response.json()
            const results = data.results || []
            const columns = data.columns || ["timestamp", "level", "message"]

            return results.map((row: any[]) => {
                const log: any = {}
                columns.forEach((col: string, index: number) => {
                    log[col] = row[index]
                })
                return log as { timestamp: string; level: string; message: string }
            })
        } catch (error: any) {
            logger.warn("Error fetching console logs", { error: error.message })
            return []
        }
    }

    /**
     * Fetch and process all session events
     */
    async fetchSessionEvents(sessionId: string, startSeconds?: number, endSeconds?: number): Promise<SessionEventsResult> {
        logger.info("Fetching session events", { sessionId, startSeconds, endSeconds })

        // Get session details
        const sessionDetails = await this.getSessionDetails(sessionId)
        const sessionUrl = `${this.apiBaseUrl}/replay/${sessionId}`
        const sessionStartTime = new Date(sessionDetails.startTime).getTime()

        // Fetch snapshots
        const snapshots = await this.getSessionSnapshots(sessionId)
        logger.info("Found session snapshots", { sessionId, count: snapshots.length })

        // Fetch and parse events in batches
        const BATCH_SIZE = 20
        const allRawEvents: RecordingSnapshot[] = []

        for (let i = 0; i < snapshots.length; i += BATCH_SIZE) {
            const slice = snapshots.slice(i, i + BATCH_SIZE)
            const eventLines = await this.getSessionEvents(sessionId, slice)
            const parsed = await parseEncodedSnapshots(eventLines, sessionId)
            allRawEvents.push(...parsed)
        }

        logger.info("Parsed raw events", { sessionId, totalEvents: allRawEvents.length })

        // Extract meaningful events
        const meaningfulEvents = extractMeaningfulEvents(allRawEvents, sessionStartTime, startSeconds, endSeconds)

        // Fetch console logs
        const consoleLogs = await this.getConsoleLogs(sessionId)

        // Filter console logs by time window if specified
        let filteredConsoleLogs = consoleLogs
        if (startSeconds !== undefined || endSeconds !== undefined) {
            filteredConsoleLogs = consoleLogs.filter(log => {
                const logTime = new Date(log.timestamp).getTime()
                const relativeSeconds = (logTime - sessionStartTime) / 1000
                if (startSeconds !== undefined && relativeSeconds < startSeconds) return false
                if (endSeconds !== undefined && relativeSeconds > endSeconds) return false
                return true
            })
        }

        return {
            sessionId,
            sessionUrl,
            startTime: sessionDetails.startTime,
            duration: sessionDetails.duration,
            totalRawEvents: allRawEvents.length,
            events: meaningfulEvents,
            consoleLogs: filteredConsoleLogs
        }
    }
}
