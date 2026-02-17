import { system } from "@openai/agents"
import type { AgentInputItem } from "@openai/agents-core"

import { RunHistoryChatMemorySession } from "./CustomMemorySession"

const FILTER_OUTCOME_MARKER_VERSION = "TERSE_FILTER_OUTCOME_MARKER_V1"
const MARKER_START = `<${FILTER_OUTCOME_MARKER_VERSION}>`
const MARKER_END = `</${FILTER_OUTCOME_MARKER_VERSION}>`

type FilterOutcomeMarkerPayload = {
    kind: "initial_event_filter_outcome"
    isRelevant: boolean
    reason: string
    confidence: number
}

export type FilterOutcomeMarkerInput = {
    isRelevant: boolean
    reason: string
    confidence: number
}

export type ParsedFilterOutcomeMarker = {
    isRelevant: boolean
    reason: string
    confidence: number
}

function clampConfidence(value: number): number {
    return Math.max(0, Math.min(1, value))
}

function buildPayload(input: FilterOutcomeMarkerInput): FilterOutcomeMarkerPayload {
    return {
        kind: "initial_event_filter_outcome",
        isRelevant: input.isRelevant,
        reason: input.reason,
        confidence: clampConfidence(input.confidence)
    }
}

function encodeMarker(payload: FilterOutcomeMarkerPayload): string {
    return `${MARKER_START}\n${JSON.stringify(payload)}\n${MARKER_END}`
}

function decodeMarker(content: string): FilterOutcomeMarkerPayload | null {
    const start = content.indexOf(MARKER_START)
    if (start === -1) return null

    const end = content.indexOf(MARKER_END, start + MARKER_START.length)
    if (end === -1) return null

    const serialized = content.slice(start + MARKER_START.length, end).trim()
    if (!serialized) return null

    try {
        const parsed = JSON.parse(serialized) as Partial<FilterOutcomeMarkerPayload>
        if (parsed.kind !== "initial_event_filter_outcome") return null
        if (typeof parsed.isRelevant !== "boolean") return null
        if (typeof parsed.reason !== "string") return null
        if (typeof parsed.confidence !== "number" || Number.isNaN(parsed.confidence)) return null

        return {
            kind: "initial_event_filter_outcome",
            isRelevant: parsed.isRelevant,
            reason: parsed.reason,
            confidence: clampConfidence(parsed.confidence)
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
    }

    if (maybeMessage.role !== "system") return null
    if (typeof maybeMessage.content === "string") return maybeMessage.content

    if (Array.isArray(maybeMessage.content)) {
        const text = maybeMessage.content
            .map(part => {
                if (typeof part !== "object" || !part) return ""
                const p = part as { text?: unknown; input_text?: unknown }
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

export function buildFilterOutcomeMarkerItem(input: FilterOutcomeMarkerInput): AgentInputItem {
    return system(encodeMarker(buildPayload(input))) as AgentInputItem
}

export function parseFilterOutcomeMarkerItem(item: unknown): ParsedFilterOutcomeMarker | null {
    const content = extractSystemMessageText(item)
    if (!content) return null

    const marker = decodeMarker(content)
    if (!marker) return null

    return {
        isRelevant: marker.isRelevant,
        reason: marker.reason,
        confidence: marker.confidence
    }
}

export async function appendFilterOutcomeMarker(runId: string, input: FilterOutcomeMarkerInput): Promise<void> {
    const session = new RunHistoryChatMemorySession({ sessionId: runId })
    await session.addItems([buildFilterOutcomeMarkerItem(input)])
}
